import { EventEmitter } from 'events';
import type {
  ClaudeCodeChildProcess,
  ClaudeCodeSpawn,
} from './claudeCodeVoiceConsoleProcess';
import { startVoiceConsoleBackend } from './voiceConsoleBackendStarter';

type SpawnMock = jest.Mock<
  ReturnType<ClaudeCodeSpawn>,
  Parameters<ClaudeCodeSpawn>
>;

const createSpawnMock = (implementation: ClaudeCodeSpawn): SpawnMock =>
  jest.fn(implementation);

const JAPANESE_CHARACTER = /[぀-ヿ一-鿿]/;
const PROXY_BASE_URL = 'http://127.0.0.1:8787';
const OAUTH_TOKEN = 'oauth-token-selected';
const API_KEY_NAMES = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEY_PERSONAL',
  'ANTHROPIC_API_KEY_PRIVATE',
];

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const parseLine = (line: string): unknown => JSON.parse(line);

const resultLine = (fields: Record<string, unknown>): string =>
  `${JSON.stringify({ type: 'result', subtype: 'success', is_error: false, ...fields })}\n`;

const createFakeChild = () => {
  const written: string[] = [];
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const lifecycle = new EventEmitter();
  const kill = jest.fn((): boolean => true);
  const child: ClaudeCodeChildProcess = {
    stdin: {
      write: (chunk: string): boolean => {
        written.push(chunk);
        return true;
      },
      end: jest.fn(),
    },
    stdout,
    stderr,
    on: <Args extends unknown[]>(
      event: 'exit' | 'error',
      handler: (...args: Args) => void,
    ) => lifecycle.on(event, handler),
    kill,
  };
  return {
    child,
    written,
    kill,
    emitStdout: (chunk: string): void => {
      stdout.emit('data', chunk);
    },
  };
};

const createInput = (
  overrides: {
    selectOauthToken?: () =>
      | { token: string; tokenName: string }
      | { error: string; diagnostics: string[] };
    isProxyUp?: () => Promise<boolean>;
    effortFlagSupported?: boolean;
    spawn?: SpawnMock;
  } = {},
) => {
  const fake = createFakeChild();
  const spawn: SpawnMock = overrides.spawn ?? createSpawnMock(() => fake.child);
  const logError = jest.fn((_message: string): void => undefined);
  const appendCommentary = jest.fn(
    (_delegationId: string, _content: string): void => undefined,
  );
  const input = {
    selectOauthToken:
      overrides.selectOauthToken ??
      (() => ({ token: OAUTH_TOKEN, tokenName: 'account-a' })),
    isProxyUp: overrides.isProxyUp ?? (() => Promise.resolve(true)),
    proxyBaseUrl: PROXY_BASE_URL,
    effortFlagSupported: overrides.effortFlagSupported ?? true,
    backendNote: 'backend note',
    baseEnv: {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'key-1',
      ANTHROPIC_API_KEY_PERSONAL: 'key-2',
      ANTHROPIC_API_KEY_PRIVATE: 'key-3',
      ANTHROPIC_BASE_URL: 'https://old.example',
    },
    spawn,
    logError,
    appendCommentary,
  };
  return { input, fake, spawn, logError, appendCommentary };
};

const readSpawnEnv = (spawn: SpawnMock): Record<string, string> => {
  const call = spawn.mock.calls[0];
  if (call === undefined) {
    throw new Error('spawn was not called');
  }
  return call[2];
};

describe('startVoiceConsoleBackend environment', () => {
  it('passes the selected OAuth token and no Anthropic API key, and sets the proxy URL only when the proxy is up', async () => {
    const cases = [
      {
        name: 'proxy up',
        proxyUp: true,
        expectedBaseUrl: PROXY_BASE_URL,
      },
      {
        name: 'proxy down',
        proxyUp: false,
        expectedBaseUrl: undefined,
      },
    ];

    for (const testCase of cases) {
      const { input, spawn } = createInput({
        isProxyUp: () => Promise.resolve(testCase.proxyUp),
      });

      await startVoiceConsoleBackend(input);

      const env = readSpawnEnv(spawn);
      expect({
        name: testCase.name,
        oauthToken: env.CLAUDE_CODE_OAUTH_TOKEN,
        baseUrl: env.ANTHROPIC_BASE_URL,
        apiKeyNames: API_KEY_NAMES.filter((name) => name in env),
      }).toEqual({
        name: testCase.name,
        oauthToken: OAUTH_TOKEN,
        baseUrl: testCase.expectedBaseUrl,
        apiKeyNames: [],
      });
    }
  });

  it('starts claude-agent with the fleet arguments and the backend note, and no MCP config', async () => {
    const cases = [
      {
        name: 'effort supported',
        effort: true,
        expectedEffort: ['--effort', 'high'],
      },
      { name: 'effort not supported', effort: false, expectedEffort: [] },
    ];

    for (const testCase of cases) {
      const { input, spawn } = createInput({
        effortFlagSupported: testCase.effort,
      });

      await startVoiceConsoleBackend(input);

      const call = spawn.mock.calls[0];
      const command = call?.[0];
      const args = call?.[1] ?? [];
      expect({
        name: testCase.name,
        command,
        hasEffort: args.includes('--effort'),
        effortArgs: args.filter((arg) => arg === '--effort' || arg === 'high'),
        hasMcpConfig: args.includes('--mcp-config'),
        hasNote: args.includes('backend note'),
      }).toEqual({
        name: testCase.name,
        command: 'claude-agent',
        hasEffort: testCase.effort,
        effortArgs: testCase.expectedEffort,
        hasMcpConfig: false,
        hasNote: true,
      });
    }
  });
});

describe('startVoiceConsoleBackend failures', () => {
  it('logs a token selection error with its diagnostics, never spawns, and speaks a failure sentence', async () => {
    const { input, spawn, logError, appendCommentary } = createInput({
      selectOauthToken: () => ({
        error: 'no eligible OAuth token',
        diagnostics: ['account-a: limited', 'account-b: limited'],
      }),
    });

    const backend = await startVoiceConsoleBackend(input);
    backend.handleDelegationCreated('delegation_1');
    await flush();

    const logged = logError.mock.calls.map((call) => call[0]).join('\n');
    const spoken = appendCommentary.mock.calls;
    expect({
      spawned: spawn.mock.calls.length,
      loggedError: logged.includes('no eligible OAuth token'),
      loggedDiagnostics:
        logged.includes('account-a: limited') &&
        logged.includes('account-b: limited'),
      spokenCount: spoken.length,
      spokenDelegation: spoken[0]?.[0],
      spokenIsJapanese: JAPANESE_CHARACTER.test(spoken[0]?.[1] ?? ''),
      spokenHasReason: (spoken[0]?.[1] ?? '').includes(
        'no eligible OAuth token',
      ),
    }).toEqual({
      spawned: 0,
      loggedError: true,
      loggedDiagnostics: true,
      spokenCount: 1,
      spokenDelegation: 'delegation_1',
      spokenIsJapanese: true,
      spokenHasReason: true,
    });
  });

  it('speaks a Japanese failure sentence and does not crash when the process cannot be started', async () => {
    const spawn: SpawnMock = createSpawnMock(() => {
      throw new Error('spawn EACCES');
    });
    const { input, logError, appendCommentary } = createInput({ spawn });

    const backend = await startVoiceConsoleBackend(input);
    backend.handleDelegationCreated('delegation_2');
    await flush();

    const logged = logError.mock.calls.map((call) => call[0]).join('\n');
    const spoken = appendCommentary.mock.calls;
    expect({
      loggedSpawnError: logged.includes('spawn EACCES'),
      spokenCount: spoken.length,
      spokenDelegation: spoken[0]?.[0],
      spokenIsJapanese: JAPANESE_CHARACTER.test(spoken[0]?.[1] ?? ''),
    }).toEqual({
      loggedSpawnError: true,
      spokenCount: 1,
      spokenDelegation: 'delegation_2',
      spokenIsJapanese: true,
    });
  });

  it('speaks a Japanese failure sentence and logs the error when the child reports an error result', async () => {
    const { input, fake, logError, appendCommentary } = createInput();

    const backend = await startVoiceConsoleBackend(input);
    backend.handleOwnerTranscriptDelta('質問です');
    backend.handleDelegationCreated('delegation_3');
    await flush();
    fake.emitStdout(
      resultLine({
        is_error: true,
        subtype: 'success',
        result: 'API overloaded',
      }),
    );
    await flush();

    const logged = logError.mock.calls.map((call) => call[0]).join('\n');
    const spoken = appendCommentary.mock.calls;
    expect({
      loggedError: logged.length > 0,
      spokenCount: spoken.length,
      spokenDelegation: spoken[0]?.[0],
      spokenIsJapanese: JAPANESE_CHARACTER.test(spoken[0]?.[1] ?? ''),
    }).toEqual({
      loggedError: true,
      spokenCount: 1,
      spokenDelegation: 'delegation_3',
      spokenIsJapanese: true,
    });
  });
});

describe('startVoiceConsoleBackend delegation', () => {
  it('sends the owner utterance as one stream-json line and speaks the result in chunks of at most 300 characters', async () => {
    const cases: {
      name: string;
      result: string;
      expectedChunks: string[];
    }[] = [
      {
        name: 'a short answer is one chunk',
        result: '短い回答です',
        expectedChunks: ['短い回答です'],
      },
      {
        name: 'a long answer is split at 300 characters',
        result: `${'a'.repeat(300)}${'b'.repeat(300)}${'c'.repeat(50)}`,
        expectedChunks: ['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(50)],
      },
    ];

    for (const testCase of cases) {
      const { input, fake, appendCommentary } = createInput();

      const backend = await startVoiceConsoleBackend(input);
      backend.handleOwnerTranscriptDelta('今日の');
      backend.handleOwnerTranscriptDelta('タスクは？');
      backend.handleDelegationCreated('delegation_4');
      await flush();
      const written = fake.written.map(parseLine);
      fake.emitStdout(resultLine({ result: testCase.result }));
      await flush();

      expect({
        name: testCase.name,
        written,
        appended: appendCommentary.mock.calls,
      }).toEqual({
        name: testCase.name,
        written: [
          {
            type: 'user',
            message: { role: 'user', content: '今日のタスクは？' },
          },
        ],
        appended: testCase.expectedChunks.map((chunk) => [
          'delegation_4',
          chunk,
        ]),
      });
    }
  });
});

describe('startVoiceConsoleBackend stop', () => {
  it('kills the child once, is safe to call twice, and is safe before any delegation', async () => {
    const cases = [
      { name: 'stop before any delegation', stopCount: 1 },
      { name: 'stop twice', stopCount: 2 },
    ];

    for (const testCase of cases) {
      const { input, fake } = createInput();

      const backend = await startVoiceConsoleBackend(input);
      for (let index = 0; index < testCase.stopCount; index += 1) {
        backend.stop();
      }

      expect({
        name: testCase.name,
        kills: fake.kill.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        kills: 1,
      });
    }
  });

  it('is safe to call after the process could not be started', async () => {
    const spawn: SpawnMock = createSpawnMock(() => {
      throw new Error('spawn EACCES');
    });
    const { input } = createInput({ spawn });

    const backend = await startVoiceConsoleBackend(input);

    expect(() => {
      backend.stop();
      backend.stop();
    }).not.toThrow();
  });
});
