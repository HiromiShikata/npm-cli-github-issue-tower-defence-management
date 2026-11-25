export type ClaudeCodeVoiceConsoleLaunchInput = {
  oauthToken: string;
  proxyBaseUrl: string | null;
  effortFlagSupported: boolean;
  backendNote: string;
  baseEnv: Record<string, string | undefined>;
};

export type ClaudeCodeVoiceConsoleLaunch = {
  command: 'claude-agent';
  args: string[];
  env: Record<string, string>;
};

const INHERITED_ENV_NAMES = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'XDG_CACHE_HOME',
  'XDG_DATA_HOME',
  'NODE_ENV',
];

const buildChildEnv = (
  input: ClaudeCodeVoiceConsoleLaunchInput,
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const name of INHERITED_ENV_NAMES) {
    const value = input.baseEnv[name];
    if (value !== undefined) {
      env[name] = value;
    }
  }
  env.CLAUDE_CODE_OAUTH_TOKEN = input.oauthToken;
  if (input.proxyBaseUrl !== null) {
    env.ANTHROPIC_BASE_URL = input.proxyBaseUrl;
  }
  return env;
};

export const buildClaudeCodeVoiceConsoleLaunch = (
  input: ClaudeCodeVoiceConsoleLaunchInput,
): ClaudeCodeVoiceConsoleLaunch => {
  const effortArgs = input.effortFlagSupported ? ['--effort', 'high'] : [];
  return {
    command: 'claude-agent',
    args: [
      '--agent',
      'general',
      '--model',
      'claude-opus-5-5',
      ...effortArgs,
      '-p',
      '--input-format',
      'stream-json',
      '--output-format',
      'stream-json',
      '--dangerously-skip-permissions',
      '--append-system-prompt',
      input.backendNote,
    ],
    env: buildChildEnv(input),
  };
};
