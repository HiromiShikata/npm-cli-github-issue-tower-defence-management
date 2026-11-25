import { VOICE_CONSOLE_TOOL_DEFINITIONS } from './voiceConsoleLiveSessionConfig';
import { handleVoiceConsoleMcpRequest } from './voiceConsoleMcpServer';

const SECRET = 'voice-mcp-secret';
const AUTHORIZED = `Bearer ${SECRET}`;
const TOOL_OUTPUT = '{"ok":true,"totalCount":4}';

const createRequestInput = (overrides: {
  authorizationHeader?: string | undefined;
  body?: unknown;
  callTool?: (name: string, argumentsJson: string) => Promise<string>;
}) => {
  const callTool = jest.fn(
    overrides.callTool ??
      ((_name: string, _argumentsJson: string) => Promise.resolve(TOOL_OUTPUT)),
  );
  const logError = jest.fn((_message: string) => undefined);
  return {
    callTool,
    logError,
    input: {
      expectedSecret: SECRET,
      authorizationHeader:
        'authorizationHeader' in overrides
          ? overrides.authorizationHeader
          : AUTHORIZED,
      body: overrides.body,
      callTool,
      logError,
    },
  };
};

const rpc = (method: string, extra: Record<string, unknown> = {}): unknown => ({
  jsonrpc: '2.0',
  id: 1,
  method,
  ...extra,
});

const readErrorCode = (body: unknown): unknown => {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined;
  }
  const error = body.error;
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  return error.code;
};

describe('handleVoiceConsoleMcpRequest authentication', () => {
  it('answers 401 and does not handle the request unless the bearer secret matches', async () => {
    const cases = [
      { name: 'no authorization header', authorizationHeader: undefined },
      { name: 'wrong secret', authorizationHeader: 'Bearer wrong-secret' },
      { name: 'secret without the Bearer scheme', authorizationHeader: SECRET },
    ];

    for (const testCase of cases) {
      const { input, callTool } = createRequestInput({
        authorizationHeader: testCase.authorizationHeader,
        body: rpc('tools/list'),
      });

      const response = await handleVoiceConsoleMcpRequest(input);

      expect({
        name: testCase.name,
        statusCode: response.statusCode,
        callToolCalls: callTool.mock.calls.length,
      }).toEqual({ name: testCase.name, statusCode: 401, callToolCalls: 0 });
    }
  });

  it('handles the request when the bearer secret matches', async () => {
    const { input } = createRequestInput({ body: rpc('tools/list') });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect(response.statusCode).toBe(200);
  });
});

describe('handleVoiceConsoleMcpRequest protocol methods', () => {
  it('answers initialize with the tools capability and server info, echoing the request id', async () => {
    const { input } = createRequestInput({
      body: rpc('initialize', {
        id: 7,
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'client', version: '1' },
        },
      }),
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      jsonrpc: '2.0',
      id: 7,
      result: {
        protocolVersion: expect.any(String),
        capabilities: { tools: {} },
        serverInfo: { name: expect.any(String), version: expect.any(String) },
      },
    });
  });

  it('answers notifications/initialized with 202 and no body', async () => {
    const { input, callTool } = createRequestInput({
      body: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect({
      statusCode: response.statusCode,
      body: response.body,
      callToolCalls: callTool.mock.calls.length,
    }).toEqual({ statusCode: 202, body: null, callToolCalls: 0 });
  });

  it('lists every voice console tool with its parameter schema as input schema', async () => {
    const { input } = createRequestInput({
      body: rpc('tools/list', { id: 'list-1' }),
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect(response.body).toEqual({
      jsonrpc: '2.0',
      id: 'list-1',
      result: {
        tools: VOICE_CONSOLE_TOOL_DEFINITIONS.map((definition) => ({
          name: definition.name,
          description: definition.description,
          inputSchema: definition.parameters,
        })),
      },
    });
  });
});

describe('handleVoiceConsoleMcpRequest tools/call', () => {
  it('calls the voice tool with its JSON arguments and returns its output as text content', async () => {
    const cases = [
      {
        name: 'a tool without arguments',
        params: { name: 'queue_overview' },
        expectedArgumentsJson: '{}',
      },
      {
        name: 'a tool with arguments',
        params: { name: 'jump_to_task', arguments: { position: 2 } },
        expectedArgumentsJson: '{"position":2}',
      },
    ];

    for (const testCase of cases) {
      const { input, callTool } = createRequestInput({
        body: rpc('tools/call', { params: testCase.params }),
      });

      const response = await handleVoiceConsoleMcpRequest(input);

      expect({
        name: testCase.name,
        call: callTool.mock.calls[0],
        body: response.body,
      }).toEqual({
        name: testCase.name,
        call: [testCase.params.name, testCase.expectedArgumentsJson],
        body: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: TOOL_OUTPUT }],
            isError: false,
          },
        },
      });
    }
  });

  it('returns a tool-level failure output unchanged and not as a JSON-RPC error', async () => {
    const toolFailure = '{"ok":false,"error":"no_pending_action"}';
    const { input } = createRequestInput({
      body: rpc('tools/call', {
        params: { name: 'confirm_pending_action', arguments: {} },
      }),
      callTool: () => Promise.resolve(toolFailure),
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect(response.body).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: {
        content: [{ type: 'text', text: toolFailure }],
        isError: false,
      },
    });
  });

  it('answers a JSON-RPC internal error and logs it when the tool throws', async () => {
    const { input, logError } = createRequestInput({
      body: rpc('tools/call', { params: { name: 'next_task' } }),
      callTool: () => Promise.reject(new Error('database unavailable')),
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect(response.body).toMatchObject({ id: 1, error: { code: -32603 } });
    expect(logError.mock.calls.map((call) => call[0]).join('\n')).toContain(
      'database unavailable',
    );
  });

  it('answers a JSON-RPC error without calling any tool when the call has no tool name', async () => {
    const cases = [
      { name: 'params without a name', params: { arguments: {} } },
      { name: 'no params at all', params: undefined },
    ];

    for (const testCase of cases) {
      const { input, callTool } = createRequestInput({
        body: rpc('tools/call', { params: testCase.params }),
      });

      const response = await handleVoiceConsoleMcpRequest(input);

      expect({
        name: testCase.name,
        hasError: readErrorCode(response.body) !== undefined,
        callToolCalls: callTool.mock.calls.length,
      }).toEqual({ name: testCase.name, hasError: true, callToolCalls: 0 });
    }
  });
});

describe('handleVoiceConsoleMcpRequest malformed requests', () => {
  it('answers -32601 for an unknown method without calling a tool', async () => {
    const { input, callTool } = createRequestInput({
      body: rpc('resources/list'),
    });

    const response = await handleVoiceConsoleMcpRequest(input);

    expect({
      code: readErrorCode(response.body),
      callToolCalls: callTool.mock.calls.length,
    }).toEqual({ code: -32601, callToolCalls: 0 });
  });

  it('answers -32600 for a body that is not a JSON-RPC 2.0 request object', async () => {
    const cases = [
      { name: 'null body', body: null },
      { name: 'string body', body: 'tools/list' },
      { name: 'array body', body: [rpc('tools/list')] },
      { name: 'missing method', body: { jsonrpc: '2.0', id: 1 } },
      {
        name: 'wrong jsonrpc version',
        body: { jsonrpc: '1.0', id: 1, method: 'tools/list' },
      },
      {
        name: 'non-string method',
        body: { jsonrpc: '2.0', id: 1, method: 5 },
      },
    ];

    for (const testCase of cases) {
      const { input, callTool } = createRequestInput({ body: testCase.body });

      const response = await handleVoiceConsoleMcpRequest(input);

      expect({
        name: testCase.name,
        code: readErrorCode(response.body),
        callToolCalls: callTool.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        code: -32600,
        callToolCalls: 0,
      });
    }
  });
});
