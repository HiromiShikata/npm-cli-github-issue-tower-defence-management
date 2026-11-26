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

type LiveSessionSideband = {
  attach(
    sessionId: string,
    handleServerEvent: (
      event: unknown,
      send: (event: Record<string, unknown>) => void,
    ) => Promise<void>,
  ): Promise<void>;
};

class RecordingLiveSessionSideband implements LiveSessionSideband {
  readonly attachedSessionIds: string[] = [];

  attach(sessionId: string): Promise<void> {
    this.attachedSessionIds.push(sessionId);
    return Promise.resolve();
  }
}

const createTestServer = async (
  liveSessionRepository: LiveSessionRepository | null,
  liveSessionSideband?: LiveSessionSideband | null,
  liveSessionCloser?: { close(sessionId: string): Promise<void> } | null,
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
    liveSessionSideband,
    liveSessionCloser,
  });
  await listen(server);
  return server;
};

describe('webServer live sessions route', () => {
  it('relays a valid SDP offer and returns the answer', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_123',
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

  it('attaches the sideband to the created session id and still returns the SDP answer', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_9',
    });
    const sideband = new RecordingLiveSessionSideband();
    const server = await createTestServer(repository, sideband);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect(response.statusCode).toBe(201);
      expect(response.contentType).toBe('application/sdp');
      expect(response.body).toBe('ANSWER-SDP');
      expect(sideband.attachedSessionIds).toEqual(['live_9']);
    } finally {
      await close(server);
    }
  });

  it('returns the SDP answer when the sideband is null or omitted', async () => {
    const cases = [{ sideband: null }, { sideband: undefined }];

    for (const testCase of cases) {
      const repository = new InMemoryLiveSessionRepository({
        type: 'created',
        sdpAnswer: 'ANSWER-SDP',
        sessionId: 'live_9',
      });
      const server = await createTestServer(repository, testCase.sideband);

      try {
        const response = await requestServer(
          server,
          'POST',
          '/api/live/sessions',
          'OFFER-SDP',
          'application/sdp',
        );
        expect({
          sideband: testCase.sideband,
          statusCode: response.statusCode,
          body: response.body,
        }).toEqual({
          sideband: testCase.sideband,
          statusCode: 201,
          body: 'ANSWER-SDP',
        });
      } finally {
        await close(server);
      }
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
      sessionId: 'live_123',
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
      sessionId: 'live_123',
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
      sessionId: 'live_123',
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

class FailingLiveSessionSideband implements LiveSessionSideband {
  constructor(private readonly message: string) {}

  attach(): Promise<void> {
    return Promise.reject(new Error(this.message));
  }
}

class NonErrorRejectionLiveSessionSideband implements LiveSessionSideband {
  attach(): Promise<void> {
    const nonErrorRejection: unknown = {
      toString: () => 'INTERNAL_MARKER_non_error_rejection',
    };
    return Promise.reject(nonErrorRejection);
  }
}

class RecordingLiveSessionCloser {
  readonly closedSessionIds: string[] = [];

  close(sessionId: string): Promise<void> {
    this.closedSessionIds.push(sessionId);
    return Promise.resolve();
  }
}

describe('webServer live session creation when the voice console sideband cannot attach', () => {
  it('fails with a non-2xx JSON error and closes the created session', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_9',
    });
    const closer = new RecordingLiveSessionCloser();
    const server = await createTestServer(
      repository,
      new FailingLiveSessionSideband(
        'OPENAI_API_KEY is not set for the live session sideband',
      ),
      closer,
    );

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      const errorBody: unknown = JSON.parse(response.body);
      expect({
        statusCode: response.statusCode,
        contentType: response.contentType,
        body: errorBody,
        closedSessionIds: closer.closedSessionIds,
      }).toEqual({
        statusCode: 502,
        contentType: 'application/json; charset=utf-8',
        body: {
          error: 'voice_console_sideband_failed',
          message: 'OPENAI_API_KEY is not set for the live session sideband',
        },
        closedSessionIds: ['live_9'],
      });
    } finally {
      await close(server);
    }
  });

  it('does not echo a non-Error sideband rejection value into the response body', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_12',
    });
    const closer = new RecordingLiveSessionCloser();
    const server = await createTestServer(
      repository,
      new NonErrorRejectionLiveSessionSideband(),
      closer,
    );

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect(response.body).not.toContain('INTERNAL_MARKER_non_error_rejection');
      expect({
        statusCode: response.statusCode,
        body: JSON.parse(response.body),
        closedSessionIds: closer.closedSessionIds,
      }).toEqual({
        statusCode: 502,
        body: {
          error: 'voice_console_sideband_failed',
          message: 'voice console sideband failed',
        },
        closedSessionIds: ['live_12'],
      });
    } finally {
      await close(server);
    }
  });

  it('fails the same way when the socket closes before it opens', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_11',
    });
    const closer = new RecordingLiveSessionCloser();
    const server = await createTestServer(
      repository,
      new FailingLiveSessionSideband(
        'OpenAI live session live_11 sideband closed before it opened',
      ),
      closer,
    );

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect({
        statusCode: response.statusCode,
        closedSessionIds: closer.closedSessionIds,
      }).toEqual({ statusCode: 502, closedSessionIds: ['live_11'] });
    } finally {
      await close(server);
    }
  });

  it('keeps the 201 SDP answer and closes nothing when the sideband attaches', async () => {
    const repository = new InMemoryLiveSessionRepository({
      type: 'created',
      sdpAnswer: 'ANSWER-SDP',
      sessionId: 'live_10',
    });
    const sideband = new RecordingLiveSessionSideband();
    const closer = new RecordingLiveSessionCloser();
    const server = await createTestServer(repository, sideband, closer);

    try {
      const response = await requestServer(
        server,
        'POST',
        '/api/live/sessions',
        'OFFER-SDP',
        'application/sdp',
      );
      expect({
        statusCode: response.statusCode,
        body: response.body,
        closedSessionIds: closer.closedSessionIds,
      }).toEqual({
        statusCode: 201,
        body: 'ANSWER-SDP',
        closedSessionIds: [],
      });
    } finally {
      await close(server);
    }
  });
});

describe('webServer live session creation when closing the session after a sideband failure also fails', () => {
  it('logs the session id with the close failure and still returns the sideband failure', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const repository = new InMemoryLiveSessionRepository({
        type: 'created',
        sdpAnswer: 'ANSWER-SDP',
        sessionId: 'live_9',
      });
      const closer = {
        close: (): Promise<void> => Promise.reject(new Error('socket refused')),
      };
      const server = await createTestServer(
        repository,
        new FailingLiveSessionSideband(
          'OPENAI_API_KEY is not set for the live session sideband',
        ),
        closer,
      );

      try {
        const response = await requestServer(
          server,
          'POST',
          '/api/live/sessions',
          'OFFER-SDP',
          'application/sdp',
        );

        expect(response.statusCode).toBe(502);
        expect(consoleError).toHaveBeenCalledWith(
          'live session live_9 could not be closed after the sideband failure: socket refused',
        );
      } finally {
        await close(server);
      }
    } finally {
      consoleError.mockRestore();
    }
  });
});
