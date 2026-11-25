import { buildClaudeCodeVoiceConsoleLaunch } from './claudeCodeVoiceConsoleLaunch';

const BACKEND_NOTE = 'backend note';
const OAUTH_TOKEN = 'oauth-token-for-test';
const PROXY_BASE_URL = 'http://127.0.0.1:8787';

const FIXED_ARGS_BEFORE_EFFORT = [
  '--agent',
  'general',
  '--model',
  'claude-opus-5-5',
];
const EFFORT_ARGS = ['--effort', 'high'];
const FIXED_ARGS_AFTER_EFFORT = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--dangerously-skip-permissions',
  '--append-system-prompt',
  BACKEND_NOTE,
];

describe('buildClaudeCodeVoiceConsoleLaunch', () => {
  it('builds the fleet launch command, arguments and environment', () => {
    const cases: {
      name: string;
      effortFlagSupported: boolean;
      proxyBaseUrl: string | null;
      baseEnv: Record<string, string | undefined>;
      expectedArgs: string[];
      expectedEnv: Record<string, string>;
    }[] = [
      {
        name: 'effort flag and proxy URL when both are available',
        effortFlagSupported: true,
        proxyBaseUrl: PROXY_BASE_URL,
        baseEnv: { PATH: '/usr/bin', HOME: '/home/test' },
        expectedArgs: [
          ...FIXED_ARGS_BEFORE_EFFORT,
          ...EFFORT_ARGS,
          ...FIXED_ARGS_AFTER_EFFORT,
        ],
        expectedEnv: {
          PATH: '/usr/bin',
          HOME: '/home/test',
          CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN,
          ANTHROPIC_BASE_URL: PROXY_BASE_URL,
        },
      },
      {
        name: 'effort flag omitted when the claude-agent CLI does not support it',
        effortFlagSupported: false,
        proxyBaseUrl: PROXY_BASE_URL,
        baseEnv: { PATH: '/usr/bin' },
        expectedArgs: [...FIXED_ARGS_BEFORE_EFFORT, ...FIXED_ARGS_AFTER_EFFORT],
        expectedEnv: {
          PATH: '/usr/bin',
          CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN,
          ANTHROPIC_BASE_URL: PROXY_BASE_URL,
        },
      },
      {
        name: 'ANTHROPIC_BASE_URL removed when the proxy is not up',
        effortFlagSupported: true,
        proxyBaseUrl: null,
        baseEnv: {
          PATH: '/usr/bin',
          ANTHROPIC_BASE_URL: 'https://old.example',
        },
        expectedArgs: [
          ...FIXED_ARGS_BEFORE_EFFORT,
          ...EFFORT_ARGS,
          ...FIXED_ARGS_AFTER_EFFORT,
        ],
        expectedEnv: {
          PATH: '/usr/bin',
          CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN,
        },
      },
      {
        name: 'the three Anthropic API key variables are stripped, not emptied',
        effortFlagSupported: true,
        proxyBaseUrl: null,
        baseEnv: {
          PATH: '/usr/bin',
          ANTHROPIC_API_KEY: 'api-key-1',
          ANTHROPIC_API_KEY_PERSONAL: 'api-key-2',
          ANTHROPIC_API_KEY_PRIVATE: 'api-key-3',
        },
        expectedArgs: [
          ...FIXED_ARGS_BEFORE_EFFORT,
          ...EFFORT_ARGS,
          ...FIXED_ARGS_AFTER_EFFORT,
        ],
        expectedEnv: {
          PATH: '/usr/bin',
          CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN,
        },
      },
      {
        name: 'an inherited OAuth token is replaced by the selected token',
        effortFlagSupported: true,
        proxyBaseUrl: null,
        baseEnv: { CLAUDE_CODE_OAUTH_TOKEN: 'inherited-token' },
        expectedArgs: [
          ...FIXED_ARGS_BEFORE_EFFORT,
          ...EFFORT_ARGS,
          ...FIXED_ARGS_AFTER_EFFORT,
        ],
        expectedEnv: { CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN },
      },
      {
        name: 'undefined inherited values are dropped from the environment',
        effortFlagSupported: true,
        proxyBaseUrl: PROXY_BASE_URL,
        baseEnv: { PATH: '/usr/bin', UNSET_VARIABLE: undefined },
        expectedArgs: [
          ...FIXED_ARGS_BEFORE_EFFORT,
          ...EFFORT_ARGS,
          ...FIXED_ARGS_AFTER_EFFORT,
        ],
        expectedEnv: {
          PATH: '/usr/bin',
          CLAUDE_CODE_OAUTH_TOKEN: OAUTH_TOKEN,
          ANTHROPIC_BASE_URL: PROXY_BASE_URL,
        },
      },
    ];

    for (const testCase of cases) {
      const launch = buildClaudeCodeVoiceConsoleLaunch({
        oauthToken: OAUTH_TOKEN,
        proxyBaseUrl: testCase.proxyBaseUrl,
        effortFlagSupported: testCase.effortFlagSupported,
        backendNote: BACKEND_NOTE,
        baseEnv: testCase.baseEnv,
      });

      expect({
        name: testCase.name,
        command: launch.command,
        args: launch.args,
        env: launch.env,
      }).toEqual({
        name: testCase.name,
        command: 'claude-agent',
        args: testCase.expectedArgs,
        env: testCase.expectedEnv,
      });
    }
  });

  it('passes no voice tool list and no MCP config to the child', () => {
    const launch = buildClaudeCodeVoiceConsoleLaunch({
      oauthToken: OAUTH_TOKEN,
      proxyBaseUrl: null,
      effortFlagSupported: true,
      backendNote: BACKEND_NOTE,
      baseEnv: {},
    });

    expect(launch.args).not.toContain('--mcp-config');
  });

  it('never passes an Anthropic API key variable to the child environment', () => {
    const launch = buildClaudeCodeVoiceConsoleLaunch({
      oauthToken: OAUTH_TOKEN,
      proxyBaseUrl: null,
      effortFlagSupported: true,
      backendNote: BACKEND_NOTE,
      baseEnv: {
        ANTHROPIC_API_KEY: 'api-key-1',
        ANTHROPIC_API_KEY_PERSONAL: 'api-key-2',
        ANTHROPIC_API_KEY_PRIVATE: 'api-key-3',
      },
    });

    const apiKeyNames = Object.keys(launch.env).filter((name) =>
      name.startsWith('ANTHROPIC_API_KEY'),
    );
    expect(apiKeyNames).toEqual([]);
  });
});

const REMOVED_ENV_NAMES = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEY_PERSONAL',
  'ANTHROPIC_API_KEY_PRIVATE',
  'CLAUDE_CODE_SESSION_ID',
];

const comparable = (value: Record<string, unknown>): string =>
  JSON.stringify(value, Object.keys(value).sort());

const summarizeChildEnv = (env: Record<string, string>) => ({
  GH_TOKEN: env.GH_TOKEN,
  SSH_AUTH_SOCK: env.SSH_AUTH_SOCK,
  OPENAI_API_KEY: env.OPENAI_API_KEY,
  ARBITRARY_SETTING: env.ARBITRARY_SETTING,
  CLAUDE_CODE_OAUTH_TOKEN: env.CLAUDE_CODE_OAUTH_TOKEN,
  ANTHROPIC_BASE_URL: env.ANTHROPIC_BASE_URL,
  removedNamesPresent: REMOVED_ENV_NAMES.filter((name) => name in env),
  unsetValuePresent: 'UNSET_VALUE' in env,
});

describe('buildClaudeCodeVoiceConsoleLaunch child environment', () => {
  const SELECTED_TOKEN = 'selected-token';

  it('passes the console environment on, removing only the API key and session id variables', () => {
    const cases: {
      name: string;
      baseEnv: Record<string, string | undefined>;
      proxyBaseUrl: string | null;
      expected: Record<string, unknown>;
    }[] = [
      {
        name: 'full console environment with the proxy up',
        baseEnv: {
          PATH: '/usr/bin',
          HOME: '/home/test',
          GH_TOKEN: 'gh-token',
          SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
          OPENAI_API_KEY: 'openai-key',
          ARBITRARY_SETTING: 'kept-value',
          ANTHROPIC_API_KEY: 'api-key-1',
          ANTHROPIC_API_KEY_PERSONAL: 'api-key-2',
          ANTHROPIC_API_KEY_PRIVATE: 'api-key-3',
          CLAUDE_CODE_SESSION_ID: 'console-session',
          CLAUDE_CODE_OAUTH_TOKEN: 'inherited-token',
          ANTHROPIC_BASE_URL: 'https://inherited.example',
        },
        proxyBaseUrl: PROXY_BASE_URL,
        expected: {
          GH_TOKEN: 'gh-token',
          SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
          OPENAI_API_KEY: 'openai-key',
          ARBITRARY_SETTING: 'kept-value',
          CLAUDE_CODE_OAUTH_TOKEN: SELECTED_TOKEN,
          ANTHROPIC_BASE_URL: PROXY_BASE_URL,
          removedNamesPresent: [],
          unsetValuePresent: false,
        },
      },
      {
        name: 'full console environment with the proxy down',
        baseEnv: {
          PATH: '/usr/bin',
          GH_TOKEN: 'gh-token',
          SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
          OPENAI_API_KEY: 'openai-key',
          ARBITRARY_SETTING: 'kept-value',
          ANTHROPIC_API_KEY: 'api-key-1',
          CLAUDE_CODE_SESSION_ID: 'console-session',
          ANTHROPIC_BASE_URL: 'https://inherited.example',
        },
        proxyBaseUrl: null,
        expected: {
          GH_TOKEN: 'gh-token',
          SSH_AUTH_SOCK: '/tmp/ssh-agent.sock',
          OPENAI_API_KEY: 'openai-key',
          ARBITRARY_SETTING: 'kept-value',
          CLAUDE_CODE_OAUTH_TOKEN: SELECTED_TOKEN,
          ANTHROPIC_BASE_URL: undefined,
          removedNamesPresent: [],
          unsetValuePresent: false,
        },
      },
      {
        name: 'undefined inherited values are not passed',
        baseEnv: {
          PATH: '/usr/bin',
          GH_TOKEN: undefined,
          OPENAI_API_KEY: undefined,
          ARBITRARY_SETTING: undefined,
          UNSET_VALUE: undefined,
        },
        proxyBaseUrl: PROXY_BASE_URL,
        expected: {
          GH_TOKEN: undefined,
          SSH_AUTH_SOCK: undefined,
          OPENAI_API_KEY: undefined,
          ARBITRARY_SETTING: undefined,
          CLAUDE_CODE_OAUTH_TOKEN: SELECTED_TOKEN,
          ANTHROPIC_BASE_URL: PROXY_BASE_URL,
          removedNamesPresent: [],
          unsetValuePresent: false,
        },
      },
    ];

    const mismatches = cases.flatMap((testCase) => {
      const launch = buildClaudeCodeVoiceConsoleLaunch({
        oauthToken: SELECTED_TOKEN,
        proxyBaseUrl: testCase.proxyBaseUrl,
        effortFlagSupported: true,
        backendNote: BACKEND_NOTE,
        baseEnv: testCase.baseEnv,
      });
      const actual = summarizeChildEnv(launch.env);
      return comparable(actual) === comparable(testCase.expected)
        ? []
        : [{ name: testCase.name, actual, expected: testCase.expected }];
    });

    expect(mismatches).toEqual([]);
  });
});
