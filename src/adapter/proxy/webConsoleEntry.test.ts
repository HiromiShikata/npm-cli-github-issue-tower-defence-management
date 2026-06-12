import * as http from 'http';
import { AddressInfo } from 'net';
import { startWebConsole } from './webConsoleEntry';

const ACCESS_KEY = 'test-access-key-123';

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

interface ClientResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

describe('startWebConsole', () => {
  let consoleServer: http.Server;
  let consolePort = 0;

  const waitForListening = (server: http.Server): Promise<number> =>
    new Promise((resolve, reject) => {
      if (server.listening) {
        resolve(addressPort(server));
        return;
      }
      server.once('listening', () => resolve(addressPort(server)));
      server.once('error', reject);
    });

  const closeServer = (server: http.Server): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

  const sendRequest = (
    method: string,
    path: string,
    headers: Record<string, string>,
  ): Promise<ClientResponse> =>
    new Promise((resolve, reject) => {
      const clientRequest = http.request(
        {
          host: '127.0.0.1',
          port: consolePort,
          method,
          path,
          headers,
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
      clientRequest.end();
    });

  beforeEach(async () => {
    consoleServer = startWebConsole(ACCESS_KEY, 0);
    consolePort = await waitForListening(consoleServer);
  });

  afterEach(async () => {
    await closeServer(consoleServer);
  });

  it('should return 200 when the correct access key is provided as a query param', async () => {
    const response = await sendRequest('GET', `/?key=${ACCESS_KEY}`, {});
    expect(response.statusCode).toBe(200);
  });

  it('should return 200 when the correct access key is provided as a Bearer token', async () => {
    const response = await sendRequest('GET', '/', {
      authorization: `Bearer ${ACCESS_KEY}`,
    });
    expect(response.statusCode).toBe(200);
  });

  it('should return 403 when an incorrect access key is provided as a query param', async () => {
    const response = await sendRequest('GET', '/?key=wrong-key', {});
    expect(response.statusCode).toBe(403);
  });

  it('should return 403 when an incorrect access key is provided as a Bearer token', async () => {
    const response = await sendRequest('GET', '/', {
      authorization: 'Bearer wrong-key',
    });
    expect(response.statusCode).toBe(403);
  });

  it('should return 403 when no access key is provided', async () => {
    const response = await sendRequest('GET', '/', {});
    expect(response.statusCode).toBe(403);
  });

  it('should return a JSON body with ok: true on successful auth', async () => {
    const response = await sendRequest('GET', `/?key=${ACCESS_KEY}`, {});
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ ok: true });
  });
});
