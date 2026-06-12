import * as http from 'http';
import * as https from 'https';
import { AddressInfo } from 'net';
import * as RateLimitCache from './RateLimitCache';

type HttpsRequestImpl = (
  options: https.RequestOptions,
  callback?: (response: http.IncomingMessage) => void,
) => http.ClientRequest;

let httpsRequestImpl: HttpsRequestImpl | null = null;

jest.mock('https', () => ({
  request: (
    options: https.RequestOptions,
    callback?: (response: http.IncomingMessage) => void,
  ): http.ClientRequest => {
    if (httpsRequestImpl === null) {
      throw new Error('https.request implementation not set');
    }
    return httpsRequestImpl(options, callback);
  },
}));

import { extractToken, startProxy } from './proxyEntry';

describe('extractToken', () => {
  it('should return the token after a Bearer prefix', () => {
    expect(extractToken('Bearer sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should accept a lowercase bearer prefix', () => {
    expect(extractToken('bearer sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should accept a mixed-case Bearer prefix', () => {
    expect(extractToken('BeArEr sk-ant-token-123')).toBe('sk-ant-token-123');
  });

  it('should trim surrounding whitespace from the token', () => {
    expect(extractToken('Bearer   sk-ant-token-123   ')).toBe(
      'sk-ant-token-123',
    );
  });

  it('should pick the first value when authorization is an array', () => {
    expect(extractToken(['Bearer token-a', 'Bearer token-b'])).toBe('token-a');
  });

  it('should return null when authorization is undefined', () => {
    expect(extractToken(undefined)).toBeNull();
  });

  it('should return null when the prefix is missing', () => {
    expect(extractToken('Basic some-credential')).toBeNull();
  });

  it('should return null when only the prefix is provided', () => {
    expect(extractToken('Bearer ')).toBeNull();
  });

  it('should return null when the input is shorter than the prefix', () => {
    expect(extractToken('Bear')).toBeNull();
  });

  it('should run in linear time on adversarial whitespace input', () => {
    const adversarial = `bearer ${' '.repeat(50000)}`;
    const startedAt = Date.now();
    expect(extractToken(adversarial)).toBeNull();
    expect(Date.now() - startedAt).toBeLessThan(500);
  });
});

interface ClientResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

const isAddressInfo = (
  address: string | AddressInfo | null,
): address is AddressInfo => address !== null && typeof address === 'object';

const addressPort = (server: http.Server): number => {
  const address = server.address();
  if (!isAddressInfo(address)) {
    throw new Error('Expected the server to be listening on a TCP port');
  }
  return address.port;
};

describe('startProxy', () => {
  const TOKEN = 'sk-ant-proxy-token';

  let upstreamServer: http.Server;
  let proxyServer: http.Server;
  let upstreamHandler: (
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ) => void;
  let upstreamShouldError = false;
  let upstreamPort = 0;
  let proxyPort = 0;
  let writeRateLimitSpy: jest.SpyInstance;
  let writeModelRateLimitSpy: jest.SpyInstance;

  const listen = (server: http.Server): Promise<number> =>
    new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        resolve(addressPort(server));
      });
    });

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

  const requestThroughProxy = (
    method: string,
    path: string,
    requestBody: string | null,
  ): Promise<ClientResponse> =>
    new Promise((resolve, reject) => {
      const clientRequest = http.request(
        {
          host: '127.0.0.1',
          port: proxyPort,
          method,
          path,
          headers: { authorization: `Bearer ${TOKEN}` },
        },
        (response) => {
          const chunks: Uint8Array[] = [];
          response.on('data', (chunk: Buffer) =>
            chunks.push(new Uint8Array(chunk)),
          );
          response.on('end', () => {
            resolve({
              statusCode: response.statusCode ?? 0,
              headers: response.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
          response.on('error', reject);
        },
      );
      clientRequest.on('error', reject);
      if (requestBody !== null) {
        clientRequest.write(requestBody);
      }
      clientRequest.end();
    });

  beforeEach(async () => {
    upstreamShouldError = false;
    upstreamHandler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    };

    upstreamServer = http.createServer((request, response) => {
      upstreamHandler(request, response);
    });
    upstreamPort = await listen(upstreamServer);

    httpsRequestImpl = (options, callback): http.ClientRequest => {
      if (upstreamShouldError) {
        return http.request({
          host: '127.0.0.1',
          port: 1,
          method: options.method,
          path: options.path,
        });
      }
      return http.request(
        {
          host: '127.0.0.1',
          port: upstreamPort,
          method: options.method,
          path: options.path,
          headers: options.headers,
        },
        callback,
      );
    };

    writeRateLimitSpy = jest
      .spyOn(RateLimitCache, 'writeRateLimit')
      .mockImplementation(() => undefined);
    writeModelRateLimitSpy = jest
      .spyOn(RateLimitCache, 'writeModelRateLimit')
      .mockImplementation(() => undefined);

    proxyPort = await new Promise<number>((resolve) => {
      const probe = http.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const value = addressPort(probe);
        probe.close(() => resolve(value));
      });
    });
    proxyServer = startProxy(proxyPort);
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    httpsRequestImpl = null;
    writeRateLimitSpy.mockRestore();
    writeModelRateLimitSpy.mockRestore();
    await closeServer(proxyServer);
    await closeServer(upstreamServer);
  });

  it('should forward the full streamed response body to the client while teeing', async () => {
    const payload = 'x'.repeat(300 * 1024);
    upstreamHandler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      let written = 0;
      const writeNext = (): void => {
        if (written >= payload.length) {
          response.end();
          return;
        }
        const slice = payload.slice(written, written + 16 * 1024);
        written += slice.length;
        response.write(slice);
        setImmediate(writeNext);
      };
      writeNext();
    };

    const response = await requestThroughProxy('POST', '/v1/messages', '{}');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(payload.length);
    expect(response.body).toBe(payload);
  });

  it('should keep forwarding the full stream even after the inspected body exceeds the 1MB cap', async () => {
    const payload = 'y'.repeat(3 * 1024 * 1024);
    const parseSpy = jest.spyOn(RateLimitCache, 'parseModelRateLimitsFromBody');
    upstreamHandler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      let written = 0;
      const writeNext = (): void => {
        if (written >= payload.length) {
          response.end();
          return;
        }
        const slice = payload.slice(written, written + 64 * 1024);
        written += slice.length;
        response.write(slice);
        setImmediate(writeNext);
      };
      writeNext();
    };

    const response = await requestThroughProxy('POST', '/v1/messages', '{}');

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveLength(payload.length);
    expect(response.body).toBe(payload);
    expect(parseSpy).toHaveBeenCalledTimes(1);
    const inspectedBody = parseSpy.mock.calls[0][0];
    expect(inspectedBody.length).toBeLessThanOrEqual(1024 * 1024 + 64 * 1024);
    parseSpy.mockRestore();
  });

  it('should parse the body on end and persist model weekly limits via writeModelRateLimit', async () => {
    const resetsAt = 1893456000;
    const body = JSON.stringify({
      type: 'error',
      error: {
        rateLimitType: 'seven_day_sonnet',
        status: 'rejected',
        resetsAt,
      },
    });
    upstreamHandler = (_request, response) => {
      response.writeHead(429, { 'content-type': 'application/json' });
      response.end(body);
    };

    const response = await requestThroughProxy('POST', '/v1/messages', '{}');

    expect(response.statusCode).toBe(429);
    expect(response.body).toBe(body);
    expect(writeModelRateLimitSpy).toHaveBeenCalledWith(TOKEN, {
      seven_day_sonnet: { rejected: true, resetsAt },
    });
    expect(writeModelRateLimitSpy).toHaveBeenCalledTimes(1);
  });

  it('should forward the upstream status code to writeRateLimit on a 429 response', async () => {
    upstreamHandler = (_request, response) => {
      response.writeHead(429, { 'content-type': 'application/json' });
      response.end('{"type":"error","error":{"type":"rate_limit_error"}}');
    };

    const response = await requestThroughProxy('POST', '/v1/messages', '{}');

    expect(response.statusCode).toBe(429);
    expect(writeRateLimitSpy).toHaveBeenCalledTimes(1);
    expect(writeRateLimitSpy).toHaveBeenCalledWith(
      TOKEN,
      expect.objectContaining({ 'content-type': 'application/json' }),
      429,
    );
  });

  it('should forward non-SSE responses without crashing', async () => {
    upstreamHandler = (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    };

    const response = await requestThroughProxy('GET', '/v1/models', null);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('{"ok":true}');
    expect(writeModelRateLimitSpy).toHaveBeenCalledTimes(1);
    expect(writeModelRateLimitSpy).toHaveBeenCalledWith(TOKEN, {});
  });

  it('should respond with 502 when the upstream request errors', async () => {
    upstreamShouldError = true;

    const response = await requestThroughProxy('GET', '/v1/models', null);

    expect(response.statusCode).toBe(502);
    expect(response.body).toBe('Upstream error');
    expect(writeModelRateLimitSpy).not.toHaveBeenCalled();
  });
});
