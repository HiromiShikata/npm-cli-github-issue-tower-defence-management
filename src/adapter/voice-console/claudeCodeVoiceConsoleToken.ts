import {
  LiveSessionOauthTokenSelectHandler,
  type LiveSessionOauthTokenSelectHandlerInput,
} from '../entry-points/handlers/LiveSessionOauthTokenSelectHandler';

export type ClaudeCodeVoiceConsoleOauthTokenResult =
  | { token: string; tokenName: string }
  | { error: string; diagnostics: string[] };

export const selectClaudeCodeVoiceConsoleOauthToken = (
  input: LiveSessionOauthTokenSelectHandlerInput,
  handler: Pick<
    LiveSessionOauthTokenSelectHandler,
    'handle'
  > = new LiveSessionOauthTokenSelectHandler(),
): ClaudeCodeVoiceConsoleOauthTokenResult => {
  const output = handler.handle(input);
  if (output.selectedToken === null || output.selectedName === null) {
    return {
      error: 'no Claude Code OAuth token is eligible for the voice console',
      diagnostics: output.diagnostics,
    };
  }
  return { token: output.selectedToken, tokenName: output.selectedName };
};
