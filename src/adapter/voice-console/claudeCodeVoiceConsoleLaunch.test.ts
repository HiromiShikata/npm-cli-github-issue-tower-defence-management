import { buildClaudeCodeVoiceConsoleLaunch } from './claudeCodeVoiceConsoleLaunch';

const MCP_CONFIG_JSON = '{"mcpServers":{"voice":{"type":"http"}}}';
const BACKEND_INSTRUCTIONS = 'backend instructions';
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
  '--mcp-config',
  MCP_CONFIG_JSON,
  '--append-system-prompt',
  BACKEND_INSTRUCTIONS,
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
        mcpConfigJson: MCP_CONFIG_JSON,
        effortFlagSupported: testCase.effortFlagSupported,
        backendInstructions: BACKEND_INSTRUCTIONS,
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

  it('never passes an Anthropic API key variable to the child environment', () => {
    const launch = buildClaudeCodeVoiceConsoleLaunch({
      oauthToken: OAUTH_TOKEN,
      proxyBaseUrl: null,
      mcpConfigJson: MCP_CONFIG_JSON,
      effortFlagSupported: true,
      backendInstructions: BACKEND_INSTRUCTIONS,
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
