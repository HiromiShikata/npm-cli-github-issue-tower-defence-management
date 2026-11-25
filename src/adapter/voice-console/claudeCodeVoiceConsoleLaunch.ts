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

const REMOVED_ENV_NAMES = [
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_API_KEY_PERSONAL',
  'ANTHROPIC_API_KEY_PRIVATE',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
];

const buildChildEnv = (
  input: ClaudeCodeVoiceConsoleLaunchInput,
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.baseEnv)) {
    if (value === undefined || REMOVED_ENV_NAMES.includes(name)) continue;
    env[name] = value;
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
