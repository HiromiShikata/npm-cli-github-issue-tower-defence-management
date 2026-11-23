import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { createWebServer } from './webServer';
import type {
  LiveSessionToolCallInput,
  LiveSessionToolCallOutcome,
  LiveSessionToolCallRunner,
} from '../../../domain/usecases/liveSession/LiveSessionToolCall';

const testToken = 'integration-test-token-value';

class RecordingToolCallRunner implements LiveSessionToolCallRunner {
  readonly inputs: LiveSessionToolCallInput[] = [];

  constructor(
    private readonly respond: (
      input: LiveSessionToolCallInput,
    ) => LiveSessionToolCallOutcome | Error,
  ) {}

  run = (
    input: LiveSessionToolCallInput,
  ): Promise<LiveSessionToolCallOutcome> => {
    this.inputs.push(input);
    const result = this.respond(input);
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(result);
  };
}

type TestResponse = { statusCode: number; body: unknown };

const parseResponseBody = (text: string): unknown => {
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const requestToolCall = (
  server: http.Server,
  payload: string,
  options: { contentType?: string | null; token?: string | null } = {},
): Promise<TestResponse> => {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('server is not listening on a TCP port');
  }
  const contentType =
    options.contentType === undefined
      ? 'application/json'
      : options.contentType;
  const token = options.token === undefined ? testToken : options.token;
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: '127.0.0.1',
        port: address.port,
        path: '/api/live/tool-calls',
        method: 'POST',
        headers: {
          ...(token === null ? {} : { 'x-pv-token': token }),
          ...(contentType === null ? {} : { 'Content-Type': contentType }),
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode ?? 0,
            body: parseResponseBody(Buffer.concat(chunks).toString('utf-8')),
          });
        });
      },
    );
    request.on('error', reject);
    request.write(payload);
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
  toolCalls: LiveSessionToolCallRunner | null,
): Promise<http.Server> => {
  const server = createWebServer({
    accessToken: testToken,
    uiDistDir: path.join(os.tmpdir(), 'missing-console-ui-dist'),
    consoleDataOutputDir: null,
    inTmuxDataDir: null,
    dashboardDir: null,
    dashboardDataDir: null,
    dashboardProjectNames: [],
    liveSessionToolCalls: toolCalls,
  });
  await listen(server);
  return server;
};

const validBody = JSON.stringify({
  name: 'session_screen_read',
  arguments: { lineCount: 20 },
  sessionName: 'session-a',
});

describe('webServer live tool calls route', () => {
  it('returns the tool output as output with status 200 and passes the call through', async () => {
    const runner = new RecordingToolCallRunner(() => ({
      kind: 'output',
      output: 'screen text',
    }));
    const server = await createTestServer(runner);
    try {
      const response = await requestToolCall(server, validBody);
      expect(response).toEqual({
        statusCode: 200,
        body: { output: 'screen text' },
      });
      expect(runner.inputs).toEqual([
        {
          name: 'session_screen_read',
          arguments: { lineCount: 20 },
          sessionName: 'session-a',
        },
      ]);
    } finally {
      await close(server);
    }
  });

  it('accepts a null sessionName and passes it as null', async () => {
    const runner = new RecordingToolCallRunner(() => ({
      kind: 'output',
      output: 'list',
    }));
    const server = await createTestServer(runner);
    try {
      const response = await requestToolCall(
        server,
        JSON.stringify({
          name: 'calling_sessions_list',
          arguments: {},
          sessionName: null,
        }),
      );
      expect(response.statusCode).toBe(200);
      expect(runner.inputs[0]?.sessionName).toBeNull();
    } finally {
      await close(server);
    }
  });

  it.each([
    {
      name: 'answers an unknown tool with unknown_tool',
      outcome: { kind: 'unknownTool' } as const,
      expected: { statusCode: 400, body: { error: 'unknown_tool' } },
    },
    {
      name: 'answers invalid arguments with invalid_arguments',
      outcome: { kind: 'invalidArguments' } as const,
      expected: { statusCode: 400, body: { error: 'invalid_arguments' } },
    },
  ])('$name', async ({ outcome, expected }) => {
    const server = await createTestServer(
      new RecordingToolCallRunner(() => outcome),
    );
    try {
      expect(await requestToolCall(server, validBody)).toEqual(expected);
    } finally {
      await close(server);
    }
  });

  it('answers a failing tool with a 500 tool_failed carrying the message', async () => {
    const server = await createTestServer(
      new RecordingToolCallRunner(() => new Error('tmux socket unavailable')),
    );
    try {
      expect(await requestToolCall(server, validBody)).toEqual({
        statusCode: 500,
        body: { error: 'tool_failed', message: 'tmux socket unavailable' },
      });
    } finally {
      await close(server);
    }
  });

  it.each([
    {
      name: 'rejects a body that is not JSON',
      payload: '{not json',
      contentType: 'application/json',
    },
    {
      name: 'rejects a body without a tool name',
      payload: JSON.stringify({ arguments: {}, sessionName: null }),
      contentType: 'application/json',
    },
    {
      name: 'rejects arguments that are not an object',
      payload: JSON.stringify({
        name: 'calling_sessions_list',
        arguments: [],
        sessionName: null,
      }),
      contentType: 'application/json',
    },
    {
      name: 'rejects a sessionName that is neither a string nor null',
      payload: JSON.stringify({
        name: 'calling_sessions_list',
        arguments: {},
        sessionName: 7,
      }),
      contentType: 'application/json',
    },
    {
      name: 'rejects a body that is not declared as application/json',
      payload: validBody,
      contentType: 'text/plain',
    },
  ])('$name with invalid_arguments', async ({ payload, contentType }) => {
    const runner = new RecordingToolCallRunner(() => ({
      kind: 'output',
      output: 'unused',
    }));
    const server = await createTestServer(runner);
    try {
      expect(await requestToolCall(server, payload, { contentType })).toEqual({
        statusCode: 400,
        body: { error: 'invalid_arguments' },
      });
      expect(runner.inputs).toEqual([]);
    } finally {
      await close(server);
    }
  });

  it('requires the access token', async () => {
    const runner = new RecordingToolCallRunner(() => ({
      kind: 'output',
      output: 'unused',
    }));
    const server = await createTestServer(runner);
    try {
      const response = await requestToolCall(server, validBody, {
        token: null,
      });
      expect(response.statusCode).toBe(401);
      expect(runner.inputs).toEqual([]);
    } finally {
      await close(server);
    }
  });

  it('answers not found when no tool runner is configured', async () => {
    const server = await createTestServer(null);
    try {
      const response = await requestToolCall(server, validBody);
      expect(response.statusCode).toBe(404);
    } finally {
      await close(server);
    }
  });
});
