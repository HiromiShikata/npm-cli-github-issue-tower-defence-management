import { EventEmitter } from 'events';
import type {
  ClaudeCodeChildProcess,
  ClaudeCodeSpawn,
} from './claudeCodeVoiceConsoleProcess';
import {
  attachVoiceConsoleBackend,
  type ClaudeChildSpawnImplementation,
  createClaudeChildSpawn,
  createClaudeEffortFlagSupportCheck,
  isClaudeEffortFlagSupported,
  isVoiceConsoleProxyUp,
  selectVoiceConsoleOauthTokenForSession,
  type VoiceConsoleSidebandConnector,
  voiceConsoleProxyBaseUrl,
} from './voiceConsoleBackendWiring';
import { selectClaudeCodeVoiceConsoleOauthToken } from './claudeCodeVoiceConsoleToken';
import { VOICE_CONSOLE_BACKEND_NOTE } from './voiceConsoleLiveSessionConfig';
import {
  attachVoiceConsoleBackendWithEnvironment,
  buildVoiceConsoleBackendStartInput,
  type VoiceConsoleBackendEnvironment,
} from './voiceConsoleBackendWiring';
import {
  startVoiceConsoleBackend,
  type VoiceConsoleBackend,
} from './voiceConsoleBackendStarter';

jest.mock('./claudeCodeVoiceConsoleToken', () => ({
  selectClaudeCodeVoiceConsoleOauthToken: jest.fn(),
}));

const JAPANESE_CHARACTER = /[぀-ヿ一-鿿]/;

const flush = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

const createFakeChild = (): ClaudeCodeChildProcess => {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const lifecycle = new EventEmitter();
  return {
    stdin: {
      write: (_chunk: string): boolean => true,
      end: jest.fn(),
    },
    stdout,
    stderr,
    on: <Args extends unknown[]>(
      event: 'exit' | 'error',
      handler: (...args: Args) => void,
    ) => lifecycle.on(event, handler),
    kill: jest.fn((): boolean => true),
  };
};

const SELECTION_SETTINGS = {
  maxConcurrentSessionCount: 3,
  fullSpeedFiveHourFreeRatio: 0.5,
  minFiveHourFreeRatio: 0.1,
  minSevenDayFreeRatio: 0.1,
  fiveHourShareConsumedPerSessionHour: 0.2,
  sevenDayShareConsumedPerSessionHour: 0.02,
};

type AttachArguments = Parameters<VoiceConsoleSidebandConnector['attach']>;
type ServerEventHandler = AttachArguments[1];

const createFakeSideband = () => {
  const captured: {
    handleServerEvent: ServerEventHandler | null;
    handleClosed: (() => void) | undefined;
  } = { handleServerEvent: null, handleClosed: undefined };
  const attach = jest.fn(
    (
      _sessionId: string,
      handleServerEvent: ServerEventHandler,
      handleClosed?: () => void,
    ): Promise<void> => {
      captured.handleServerEvent = handleServerEvent;
      captured.handleClosed = handleClosed;
      return Promise.resolve();
    },
  );
  return { sideband: { attach }, attach, captured };
};

const createFakeBackend = () => {
  const stop = jest.fn((): void => undefined);
  const backend: VoiceConsoleBackend = {
    handleOwnerTranscriptDelta: (_delta: string): void => undefined,
    handleDelegationCreated: (_delegationId: string): void => undefined,
    stop,
  };
  return { backend, stop };
};

describe('isClaudeEffortFlagSupported', () => {
  it('reports the effort flag from the claude help output and logs a failing help run', () => {
    const cases: {
      name: string;
      runHelp: () => string;
      expected: boolean;
      expectedLogFragment: string | null;
    }[] = [
      {
        name: 'help output lists --effort',
        runHelp: () =>
          'Usage: claude [options]\n  --effort <level>  effort level',
        expected: true,
        expectedLogFragment: null,
      },
      {
        name: 'help output does not list --effort',
        runHelp: () => 'Usage: claude [options]\n  --model <model>',
        expected: false,
        expectedLogFragment: null,
      },
      {
        name: 'claude --help throws',
        runHelp: () => {
          throw new Error('spawn ENOENT');
        },
        expected: false,
        expectedLogFragment: 'spawn ENOENT',
      },
    ];

    for (const testCase of cases) {
      const logError = jest.fn((_message: string): void => undefined);

      const supported = isClaudeEffortFlagSupported(testCase.runHelp, logError);

      const logged = logError.mock.calls.map((call) => call[0]).join('\n');
      expect({
        name: testCase.name,
        supported,
        loggedCount: logError.mock.calls.length,
        loggedContainsFragment:
          testCase.expectedLogFragment === null
            ? true
            : logged.includes(testCase.expectedLogFragment),
      }).toEqual({
        name: testCase.name,
        supported: testCase.expected,
        loggedCount: testCase.expectedLogFragment === null ? 0 : 1,
        loggedContainsFragment: true,
      });
    }
  });
});

describe('createClaudeEffortFlagSupportCheck', () => {
  it('runs claude --help once and returns the same answer on every later call', () => {
    const cases = [
      { name: 'help lists --effort', output: '--effort', expected: true },
      {
        name: 'help does not list --effort',
        output: '--model',
        expected: false,
      },
    ];

    for (const testCase of cases) {
      const runHelp = jest.fn(() => testCase.output);
      const check = createClaudeEffortFlagSupportCheck(
        runHelp,
        jest.fn((_message: string): void => undefined),
      );

      const answers = [check(), check(), check()];

      expect({
        name: testCase.name,
        answers,
        runs: runHelp.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        answers: [testCase.expected, testCase.expected, testCase.expected],
        runs: 1,
      });
    }
  });

  it('answers false and logs once when claude --help fails, without running it again', () => {
    const runHelp = jest.fn((): string => {
      throw new Error('spawn ENOENT');
    });
    const logError = jest.fn((_message: string): void => undefined);
    const check = createClaudeEffortFlagSupportCheck(runHelp, logError);

    const answers = [check(), check()];

    expect({
      answers,
      runs: runHelp.mock.calls.length,
      logged: logError.mock.calls.length,
    }).toEqual({ answers: [false, false], runs: 1, logged: 1 });
  });
});

describe('voiceConsoleProxyBaseUrl', () => {
  it('builds the loopback base URL from the port', () => {
    const cases = [
      { port: 8787, expected: 'http://127.0.0.1:8787' },
      { port: 9000, expected: 'http://127.0.0.1:9000' },
    ];

    for (const testCase of cases) {
      expect({
        port: testCase.port,
        url: voiceConsoleProxyBaseUrl(testCase.port),
      }).toEqual({ port: testCase.port, url: testCase.expected });
    }
  });
});

describe('isVoiceConsoleProxyUp', () => {
  it('reports the proxy as up or down from the probe result', async () => {
    const cases = [
      {
        name: 'probe resolves true',
        probe: Promise.resolve(true),
        expected: true,
      },
      {
        name: 'probe resolves false',
        probe: Promise.resolve(false),
        expected: false,
      },
    ];

    for (const testCase of cases) {
      const ensureProxyRunning = jest.fn((_port: number) => testCase.probe);
      const logError = jest.fn((_message: string): void => undefined);

      const up = await isVoiceConsoleProxyUp({
        port: 8787,
        ensureProxyRunning,
        logError,
      });

      expect({
        name: testCase.name,
        up,
        probedPorts: ensureProxyRunning.mock.calls.map((call) => call[0]),
        logged: logError.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        up: testCase.expected,
        probedPorts: [8787],
        logged: 0,
      });
    }
  });

  it('reports the proxy as down and logs the error when the probe rejects', async () => {
    const ensureProxyRunning = jest.fn((_port: number) =>
      Promise.reject(new Error('bind EADDRINUSE')),
    );
    const logError = jest.fn((_message: string): void => undefined);

    const up = await isVoiceConsoleProxyUp({
      port: 8787,
      ensureProxyRunning,
      logError,
    });

    const logged = logError.mock.calls.map((call) => call[0]).join('\n');
    expect({
      up,
      loggedFragment: logged.includes('bind EADDRINUSE'),
    }).toEqual({ up: false, loggedFragment: true });
  });
});

describe('createClaudeChildSpawn', () => {
  it('passes the command, arguments, the given environment and piped stdio to the spawn implementation', () => {
    const cases: {
      name: string;
      command: string;
      args: string[];
      env: Record<string, string>;
    }[] = [
      {
        name: 'environment passed through',
        command: 'claude-agent',
        args: ['--agent', 'general', '-p'],
        env: { PATH: '/usr/bin', CLAUDE_CODE_OAUTH_TOKEN: 'token' },
      },
      {
        name: 'empty environment',
        command: 'claude-agent',
        args: [],
        env: {},
      },
    ];

    for (const testCase of cases) {
      const child = createFakeChild();
      const spawnImplementation = jest.fn<
        ReturnType<ClaudeChildSpawnImplementation>,
        Parameters<ClaudeChildSpawnImplementation>
      >(() => child);

      const spawn: ClaudeCodeSpawn =
        createClaudeChildSpawn(spawnImplementation);
      const returned = spawn(testCase.command, testCase.args, testCase.env);

      expect({
        name: testCase.name,
        calls: spawnImplementation.mock.calls,
        sameChild: returned === child,
      }).toEqual({
        name: testCase.name,
        calls: [
          [
            testCase.command,
            testCase.args,
            { env: testCase.env, stdio: ['pipe', 'pipe', 'pipe'] },
          ],
        ],
        sameChild: true,
      });
    }
  });
});

describe('selectVoiceConsoleOauthTokenForSession', () => {
  it('reports a settings load failure as an error with its diagnostic and does not select a token', () => {
    const select = jest.fn(() => ({ token: 'unused', tokenName: 'unused' }));

    const result = selectVoiceConsoleOauthTokenForSession(
      {
        loadSelectionSettings: () => {
          throw new Error('settings file missing');
        },
        tokenListJsonPath: null,
        cacheDirectory: null,
        nowEpochSeconds: 1_800_000_000,
      },
      select,
    );

    expect({
      hasToken: 'token' in result,
      diagnosticsMention:
        'error' in result &&
        result.diagnostics.join('\n').includes('settings file missing'),
      selectCalls: select.mock.calls.length,
    }).toEqual({ hasToken: false, diagnosticsMention: true, selectCalls: 0 });
  });

  it('passes the loaded selection settings and the session inputs to the selector and returns its result', () => {
    const select = jest.fn(() => ({
      token: 'token-a',
      tokenName: 'account-a',
    }));

    const result = selectVoiceConsoleOauthTokenForSession(
      {
        loadSelectionSettings: () => SELECTION_SETTINGS,
        tokenListJsonPath: '/etc/tdpm/tokens.json',
        cacheDirectory: '/var/cache/tdpm',
        nowEpochSeconds: 1_800_000_000,
      },
      select,
    );

    expect({
      result,
      calls: select.mock.calls,
    }).toEqual({
      result: { token: 'token-a', tokenName: 'account-a' },
      calls: [
        [
          {
            tokenListJsonPath: '/etc/tdpm/tokens.json',
            cacheDirectory: '/var/cache/tdpm',
            nowEpochSeconds: 1_800_000_000,
            selectionSettings: SELECTION_SETTINGS,
          },
        ],
      ],
    });
  });
});

describe('attachVoiceConsoleBackend', () => {
  it('stops the backend exactly once when the sideband closes', async () => {
    const { sideband, captured } = createFakeSideband();
    const { backend, stop } = createFakeBackend();

    await attachVoiceConsoleBackend({
      sideband,
      sessionId: 'session-1',
      startBackend: () => Promise.resolve(backend),
      newEventId: () => 'event-1',
      logError: jest.fn((_message: string): void => undefined),
    });
    expect(stop.mock.calls.length).toBe(0);

    captured.handleClosed?.();

    expect(stop.mock.calls.length).toBe(1);
  });

  it('stops the backend and rethrows when the sideband cannot be attached', async () => {
    const attach = jest.fn((): Promise<void> =>
      Promise.reject(new Error('sideband unavailable')),
    );
    const { backend, stop } = createFakeBackend();

    await expect(
      attachVoiceConsoleBackend({
        sideband: { attach },
        sessionId: 'session-2',
        startBackend: () => Promise.resolve(backend),
        newEventId: () => 'event-2',
        logError: jest.fn((_message: string): void => undefined),
      }),
    ).rejects.toThrow('sideband unavailable');
    expect(stop.mock.calls.length).toBe(1);
  });

  it('speaks a token failure through the sideband as a commentary append and starts no process', async () => {
    const { sideband, captured } = createFakeSideband();
    const child = createFakeChild();
    const spawn = jest.fn(
      (_command: string, _args: string[], _env: Record<string, string>) =>
        child,
    );
    const logError = jest.fn((_message: string): void => undefined);

    await attachVoiceConsoleBackend({
      sideband,
      sessionId: 'session-3',
      startBackend: (appendCommentary) =>
        startVoiceConsoleBackend({
          selectOauthToken: () => ({
            error: 'no eligible OAuth token',
            diagnostics: ['account-a: limited'],
          }),
          isProxyUp: () => Promise.resolve(true),
          proxyBaseUrl: 'http://127.0.0.1:8787',
          effortFlagSupported: true,
          backendNote: 'backend note',
          baseEnv: {},
          spawn,
          logError,
          appendCommentary,
        }),
      newEventId: () => 'event-3',
      logError,
    });

    const send = jest.fn((_event: Record<string, unknown>): void => undefined);
    const handleServerEvent = captured.handleServerEvent;
    if (handleServerEvent === null) {
      throw new Error('sideband handler was not attached');
    }
    await handleServerEvent(
      {
        type: 'session.delegation.created',
        event_id: 'delegation-event-3',
        delegation: { id: 'delegation_3' },
      },
      send,
    );
    await flush();

    const appended = send.mock.calls.map((call) => call[0]);
    expect({
      spawned: spawn.mock.calls.length,
      appendedType: appended[0]?.type,
      appendedDelegation: appended[0]?.delegation_id,
      appendedEventId: appended[0]?.event_id,
      appendedContentIsJapanese: JAPANESE_CHARACTER.test(
        String(appended[0]?.content),
      ),
      appendedCount: appended.length,
    }).toEqual({
      spawned: 0,
      appendedType: 'session.commentary.append',
      appendedDelegation: 'delegation_3',
      appendedEventId: 'event-3',
      appendedContentIsJapanese: true,
      appendedCount: 1,
    });
  });
});

const selectTokenMock = jest.mocked(selectClaudeCodeVoiceConsoleOauthToken);

const createEnvironment = (
  customize: (
    environment: VoiceConsoleBackendEnvironment & {
      loadSelectionSettings: jest.Mock;
      resolveTokenListJsonPath: jest.Mock;
      resolveCacheDirectory: jest.Mock;
      ensureProxyRunning: jest.Mock;
      effortFlagSupported: jest.Mock;
      spawn: jest.Mock;
      logError: jest.Mock;
    },
  ) => void = () => undefined,
) => {
  const child = createFakeChild();
  const environment = {
    resolveFleetConfigFilePath: jest.fn(
      (_cliValue: string | null): string | null => '/etc/fleet.json',
    ),
    loadSelectionSettings: jest.fn(
      (_fleetConfigFilePath: string | null) => SELECTION_SETTINGS,
    ),
    resolveTokenListJsonPath: jest.fn(
      (_explicitPath: string | null): string | null => '/etc/tdpm/tokens.json',
    ),
    resolveCacheDirectory: jest.fn(
      (_explicitDirectory: string | null): string => '/var/cache/tdpm',
    ),
    readNowEpochSeconds: jest.fn((): number => 1_800_000_000),
    ensureProxyRunning: jest.fn((_port: number): Promise<boolean> =>
      Promise.resolve(true),
    ),
    proxyPort: 8787,
    effortFlagSupported: jest.fn((): boolean => true),
    baseEnv: {
      PATH: '/usr/bin',
      ANTHROPIC_API_KEY: 'api-key',
    } satisfies Record<string, string | undefined>,
    spawn: jest.fn(
      (_command: string, _args: string[], _env: Record<string, string>) =>
        child,
    ),
    logError: jest.fn((_message: string): void => undefined),
  };
  customize(environment);
  return environment;
};

describe('buildVoiceConsoleBackendStartInput token selection', () => {
  beforeEach(() => {
    selectTokenMock.mockReset();
  });

  it('loads the fleet settings and passes the token list path and cache directory to the selector', () => {
    const cases = [
      {
        name: 'paths resolved',
        tokenListJsonPath: '/etc/tdpm/tokens.json',
        cacheDirectory: '/var/cache/tdpm',
      },
      {
        name: 'paths resolved to other locations',
        tokenListJsonPath: '/home/owner/tokens.json',
        cacheDirectory: '/tmp/tdpm-cache',
      },
    ];

    for (const testCase of cases) {
      selectTokenMock.mockReset();
      selectTokenMock.mockReturnValue({
        token: 'token-a',
        tokenName: 'account-a',
      });
      const environment = createEnvironment((env) => {
        env.resolveTokenListJsonPath.mockReturnValue(
          testCase.tokenListJsonPath,
        );
        env.resolveCacheDirectory.mockReturnValue(testCase.cacheDirectory);
      });
      const input = buildVoiceConsoleBackendStartInput(
        environment,
        jest.fn((_delegationId: string, _content: string): void => undefined),
      );

      const result = input.selectOauthToken();

      expect({
        name: testCase.name,
        loadedFrom: environment.loadSelectionSettings.mock.calls,
        selectorInput: selectTokenMock.mock.calls,
        result,
      }).toEqual({
        name: testCase.name,
        loadedFrom: [['/etc/fleet.json']],
        selectorInput: [
          [
            {
              tokenListJsonPath: testCase.tokenListJsonPath,
              cacheDirectory: testCase.cacheDirectory,
              nowEpochSeconds: 1_800_000_000,
              selectionSettings: SELECTION_SETTINGS,
            },
          ],
        ],
        result: { token: 'token-a', tokenName: 'account-a' },
      });
    }
  });

  it('reports a fleet settings load failure as an error and never calls the selector', () => {
    const environment = createEnvironment((env) => {
      env.loadSelectionSettings.mockImplementation(() => {
        throw new Error('fleet config unreadable');
      });
    });
    const input = buildVoiceConsoleBackendStartInput(
      environment,
      jest.fn((_delegationId: string, _content: string): void => undefined),
    );

    const result = input.selectOauthToken();

    expect({
      hasToken: 'token' in result,
      diagnosticsMention:
        'error' in result &&
        result.diagnostics.join('\n').includes('fleet config unreadable'),
      selectorCalls: selectTokenMock.mock.calls.length,
    }).toEqual({ hasToken: false, diagnosticsMention: true, selectorCalls: 0 });
  });
});

describe('buildVoiceConsoleBackendStartInput proxy and environment', () => {
  it('probes the proxy on the configured port and reports up or down', async () => {
    const cases = [
      { name: 'probe resolves true', probe: true },
      { name: 'probe resolves false', probe: false },
    ];

    for (const testCase of cases) {
      const environment = createEnvironment((env) => {
        env.ensureProxyRunning.mockReturnValue(Promise.resolve(testCase.probe));
      });
      const input = buildVoiceConsoleBackendStartInput(
        environment,
        jest.fn((_delegationId: string, _content: string): void => undefined),
      );

      const up = await input.isProxyUp();

      expect({
        name: testCase.name,
        up,
        probedPorts: environment.ensureProxyRunning.mock.calls.map(
          (call) => call[0],
        ),
      }).toEqual({
        name: testCase.name,
        up: testCase.probe,
        probedPorts: [8787],
      });
    }
  });

  it('reports the proxy as down and logs when the probe rejects', async () => {
    const environment = createEnvironment((env) => {
      env.ensureProxyRunning.mockImplementation(() =>
        Promise.reject(new Error('bind EADDRINUSE')),
      );
    });
    const input = buildVoiceConsoleBackendStartInput(
      environment,
      jest.fn((_delegationId: string, _content: string): void => undefined),
    );

    const up = await input.isProxyUp();

    const logged = environment.logError.mock.calls
      .map((call) => call[0])
      .join('\n');
    expect({ up, loggedFragment: logged.includes('bind EADDRINUSE') }).toEqual({
      up: false,
      loggedFragment: true,
    });
  });

  it('passes the proxy base URL, the effort flag, the note, the environment and the sinks through', () => {
    const cases = [
      { name: 'effort supported', effort: true },
      { name: 'effort not supported', effort: false },
    ];

    for (const testCase of cases) {
      const appendCommentary = jest.fn(
        (_delegationId: string, _content: string): void => undefined,
      );
      const environment = createEnvironment((env) => {
        env.effortFlagSupported.mockReturnValue(testCase.effort);
      });

      const input = buildVoiceConsoleBackendStartInput(
        environment,
        appendCommentary,
      );

      expect({
        name: testCase.name,
        proxyBaseUrl: input.proxyBaseUrl,
        effortFlagSupported: input.effortFlagSupported,
        backendNote: input.backendNote,
        baseEnv: input.baseEnv,
        spawnIsEnvironmentSpawn: input.spawn === environment.spawn,
        logErrorIsEnvironmentLogError: input.logError === environment.logError,
        appendCommentaryIsGiven: input.appendCommentary === appendCommentary,
      }).toEqual({
        name: testCase.name,
        proxyBaseUrl: 'http://127.0.0.1:8787',
        effortFlagSupported: testCase.effort,
        backendNote: VOICE_CONSOLE_BACKEND_NOTE,
        baseEnv: { PATH: '/usr/bin', ANTHROPIC_API_KEY: 'api-key' },
        spawnIsEnvironmentSpawn: true,
        logErrorIsEnvironmentLogError: true,
        appendCommentaryIsGiven: true,
      });
    }
  });
});

describe('attachVoiceConsoleBackendWithEnvironment', () => {
  beforeEach(() => {
    selectTokenMock.mockReset();
  });

  it('speaks a fleet settings failure through the sideband, logs it and starts no process', async () => {
    const { sideband, captured } = createFakeSideband();
    const environment = createEnvironment((env) => {
      env.loadSelectionSettings.mockImplementation(() => {
        throw new Error('fleet config unreadable');
      });
    });

    await attachVoiceConsoleBackendWithEnvironment({
      sideband,
      sessionId: 'session-4',
      environment,
      newEventId: () => 'event-4',
      logError: environment.logError,
    });
    const send = jest.fn((_event: Record<string, unknown>): void => undefined);
    const handleServerEvent = captured.handleServerEvent;
    if (handleServerEvent === null) {
      throw new Error('sideband handler was not attached');
    }
    await handleServerEvent(
      {
        type: 'session.delegation.created',
        event_id: 'delegation-event-4',
        delegation: { id: 'delegation_4' },
      },
      send,
    );
    await flush();

    const appended = send.mock.calls.map((call) => call[0]);
    const logged = environment.logError.mock.calls
      .map((call) => call[0])
      .join('\n');
    expect({
      spawned: environment.spawn.mock.calls.length,
      loggedReason: logged.includes('fleet config unreadable'),
      appendedDelegation: appended[0]?.delegation_id,
      appendedIsJapanese: JAPANESE_CHARACTER.test(String(appended[0]?.content)),
      appendedCount: appended.length,
    }).toEqual({
      spawned: 0,
      loggedReason: true,
      appendedDelegation: 'delegation_4',
      appendedIsJapanese: true,
      appendedCount: 1,
    });
  });

  it('starts claude-agent with the selected token, the proxy URL only when the proxy is up, and the effort flag only when supported', async () => {
    const cases = [
      { name: 'proxy up and effort supported', proxyUp: true, effort: true },
      {
        name: 'proxy down and effort not supported',
        proxyUp: false,
        effort: false,
      },
    ];

    for (const testCase of cases) {
      selectTokenMock.mockReset();
      selectTokenMock.mockReturnValue({
        token: 'token-a',
        tokenName: 'account-a',
      });
      const { sideband } = createFakeSideband();
      const environment = createEnvironment((env) => {
        env.ensureProxyRunning.mockReturnValue(
          Promise.resolve(testCase.proxyUp),
        );
        env.effortFlagSupported.mockReturnValue(testCase.effort);
      });

      await attachVoiceConsoleBackendWithEnvironment({
        sideband,
        sessionId: 'session-5',
        environment,
        newEventId: () => 'event-5',
        logError: environment.logError,
      });

      const call = environment.spawn.mock.calls[0];
      const args = call?.[1] ?? [];
      const env = call?.[2] ?? {};
      expect({
        name: testCase.name,
        command: call?.[0],
        oauthToken: env.CLAUDE_CODE_OAUTH_TOKEN,
        baseUrl: env.ANTHROPIC_BASE_URL,
        hasEffort: args.includes('--effort'),
        apiKeyPresent: 'ANTHROPIC_API_KEY' in env,
      }).toEqual({
        name: testCase.name,
        command: 'claude-agent',
        oauthToken: 'token-a',
        baseUrl: testCase.proxyUp ? 'http://127.0.0.1:8787' : undefined,
        hasEffort: testCase.effort,
        apiKeyPresent: false,
      });
    }
  });
});
