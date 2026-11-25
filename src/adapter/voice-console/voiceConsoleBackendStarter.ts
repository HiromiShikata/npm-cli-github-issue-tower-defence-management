import { randomUUID } from 'crypto';
import { buildClaudeCodeVoiceConsoleLaunch } from './claudeCodeVoiceConsoleLaunch';
import {
  ClaudeCodeSpawn,
  ClaudeCodeVoiceConsoleProcess,
} from './claudeCodeVoiceConsoleProcess';
import type { ClaudeCodeVoiceConsoleOauthTokenResult } from './claudeCodeVoiceConsoleToken';
import { VoiceConsoleDelegationBridge } from './voiceConsoleDelegationBridge';

export type VoiceConsoleBackend = {
  handleOwnerTranscriptDelta(delta: string): void;
  handleDelegationCreated(delegationId: string): void;
  stop(): void;
};

export type VoiceConsoleBackendStarterInput = {
  selectOauthToken: () => ClaudeCodeVoiceConsoleOauthTokenResult;
  isProxyUp: () => Promise<boolean>;
  proxyBaseUrl: string;
  effortFlagSupported: boolean;
  backendNote: string;
  baseEnv: Record<string, string | undefined>;
  spawn: ClaudeCodeSpawn;
  logError: (message: string) => void;
  appendCommentary: (delegationId: string, content: string) => void;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const buildBackend = (
  input: VoiceConsoleBackendStarterInput,
  sendToBackend: (utterance: string) => Promise<string>,
  stop: () => void,
): VoiceConsoleBackend => {
  const bridge = new VoiceConsoleDelegationBridge({
    sendToBackend,
    appendCommentary: input.appendCommentary,
    newEventId: () => randomUUID(),
    logError: input.logError,
  });
  return {
    handleOwnerTranscriptDelta: (delta) =>
      bridge.handleOwnerTranscriptDelta(delta),
    handleDelegationCreated: (delegationId) =>
      bridge.handleDelegationCreated(delegationId),
    stop,
  };
};

const buildFailedBackend = (
  input: VoiceConsoleBackendStarterInput,
  reason: string,
): VoiceConsoleBackend =>
  buildBackend(
    input,
    () => Promise.reject(new Error(reason)),
    () => undefined,
  );

export const startVoiceConsoleBackend = async (
  input: VoiceConsoleBackendStarterInput,
): Promise<VoiceConsoleBackend> => {
  const tokenResult = input.selectOauthToken();
  if ('error' in tokenResult) {
    const reason = `${tokenResult.error}: ${tokenResult.diagnostics.join('; ')}`;
    input.logError(`voice console has no Claude Code backend: ${reason}`);
    return buildFailedBackend(input, reason);
  }
  const proxyBaseUrl = (await input.isProxyUp()) ? input.proxyBaseUrl : null;
  const launch = buildClaudeCodeVoiceConsoleLaunch({
    oauthToken: tokenResult.token,
    proxyBaseUrl,
    effortFlagSupported: input.effortFlagSupported,
    backendNote: input.backendNote,
    baseEnv: input.baseEnv,
  });
  const claudeProcess = new ClaudeCodeVoiceConsoleProcess({
    spawn: input.spawn,
    logError: input.logError,
  });
  try {
    claudeProcess.start(launch);
  } catch (error) {
    const reason = describeError(error);
    input.logError(
      `voice console Claude Code process (token ${tokenResult.tokenName}) could not start: ${reason}`,
    );
    return buildFailedBackend(input, reason);
  }
  return buildBackend(
    input,
    (utterance) => claudeProcess.sendOwnerUtterance(utterance),
    () => claudeProcess.stop(),
  );
};
