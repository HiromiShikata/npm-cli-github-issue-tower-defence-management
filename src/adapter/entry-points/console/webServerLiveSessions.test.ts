import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { createWebServer } from './webServer';
import type {
  LiveSessionCreateResult,
  LiveSessionRepository,
} from '../../../domain/usecases/adapter-interfaces/LiveSessionRepository';

const testToken = 'integration-test-token-value';

class InMemoryLiveSessionRepository implements LiveSessionRepository {
  readonly calls: string[] = [];

  constructor(private readonly result: LiveSessionCreateResult) {}

  createFromSdpOffer(sdpOffer: string): Promise<LiveSessionCreateResult> {
    this.calls.push(sdpOffer);
    return Promise.resolve(this.result);
  }
}

const requestServer = (
  server: http.Server,
  method: string,
  requestPath: string,
  body: string | undefined,
  contentType: string | undefined,
  token: string | null = testToken,
): Promise<{
  statusCode: number;
  body: string;
  contentType: string | undefined;
}> => {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  const payload = body ?? '';
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: requestPath,
        method,
        headers: {
          ...(token === null ? {} : { 'x-pv-token': token }),
          ...(contentType === undefined ? {} : { 'Content-Type': contentType }),
          ...(method === 'POST'
            ? { 'Content-Length': Buffer.byteLength(payload) }
            : {}),
        },
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf-8'),
            contentType: response.headers['content-type'],
          });
        });
      },
    );
    request.on('error', reject);
    if (method === 'POST') {
      request.write(payload);
    }
    request.end();
  });
};

const listen = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

const close = (server: http.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

const createTestServer = async (
  liveSessionRepository: LiveSessionRepository | null,
): Promise<http.Server> => {
  const server = createWebServer({
    accessToken: testToken,
    uiDistDir: path.join(os.tmpdir(), 'missing-console-ui-dist'),
    consoleDataOutputDir: null,
    inTmuxDataDir: null,
    dashboardDir: null,
    dashboardDataDir: null,
    dashboardProjectNames: [],
    liveSessionRepository,
  });
  await listen(server);
  return server;
};

describe('webServer live sessions route', () => {
  it('relays a valid SDP offer and returns the answer', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
    });
    const server = await createTestServer(repository);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect(repository.calls).toEqual(['OFFER-SDP']);
      expect(response.statusCode).toBe(201);
      expect(response.contentType).toBe('application/sdp');
      expect(response.body).toBe('ANSWER-SDP');
    } finally {
      await close(server);
    }
  });

  it('returns a service-unavailable JSON error while keeping features available when the key is missing', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'apiKeyMissing',
    });
    const server = await createTestServer(repository);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      const features = await requestServer(
        server,
        'GET',
        '/api/features',
        undefined,
        undefined,
      );
      expect(response.statusCode).toBe(503);
      expect(response.contentType).toBe('application/json; charset=utf-8');
      expect(response.body).toBe('{"error":"openai_api_key_missing"}');
      expect(features.statusCode).toBe(200);
    } finally {
      await close(server);
    }
  });

  it('returns the mapped upstream failure', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'openAiFailed',
      status: 429,
      message: 'rate limited',
    });
    const server = await createTestServer(repository);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect(response.statusCode).toBe(502);
      expect(response.contentType).toBe('application/json; charset=utf-8');
      expect(response.body).toBe(
        '{"error":"openai_live_session_failed","status":429,"message":"rate limited"}',
      );
    } finally {
      await close(server);
    }
  });

  it('rejects invalid request bodies and content types without calling the repository', async () => {
    const cases = [
      { body: '', contentType: 'application/sdp' },
      { body: 'OFFER-SDP', contentType: 'application/json' },
    ];
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
    });
    const server = await createTestServer(repository);

    try {
      for (const testCase of cases) {
        const response = await requestServer(
          server,
          'POST',
          '/api/live/sessions',
          testCase.body,
          testCase.contentType,
        );
        expect(response.statusCode).toBe(400);
      }
      expect(repository.calls).toEqual([]);
    } finally {
      await close(server);
    }
  });

  it('rejects bad and missing tokens without calling the repository', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
    });
    const server = await createTestServer(repository);

    try {
      const badToken = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
        'wrong-token',
      );
      const missingToken = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
        null,
      );
      expect(badToken.statusCode).toBe(401);
      expect(missingToken.statusCode).toBe(401);
      expect(repository.calls).toEqual([]);
    } finally {
      await close(server);
    }
  });

  it('accepts an SDP content type parameter', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
    });
    const server = await createTestServer(repository);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp; charset=utf-8',
      );
      expect(repository.calls).toEqual(['OFFER-SDP']);
      expect(response.statusCode).toBe(201);
      expect(response.body).toBe('ANSWER-SDP');
    } finally {
      await close(server);
    }
  });
});
