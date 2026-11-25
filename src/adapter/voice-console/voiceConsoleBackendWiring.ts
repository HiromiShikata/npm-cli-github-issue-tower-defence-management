import { execFileSync, spawn as nodeSpawn } from 'child_process';
import type { LiveSessionOauthTokenSelectionSettings } from '../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import type { LiveSessionOauthTokenSelectHandlerInput } from '../entry-points/handlers/LiveSessionOauthTokenSelectHandler';
import type { VoiceConsoleServerEventHandler } from '../repositories/OpenAiLiveSessionSideband';
import type {
  ClaudeCodeChildProcess,
  ClaudeCodeSpawn,
} from './claudeCodeVoiceConsoleProcess';
import {
  type ClaudeCodeVoiceConsoleOauthTokenResult,
  selectClaudeCodeVoiceConsoleOauthToken,
} from './claudeCodeVoiceConsoleToken';
import {
  startVoiceConsoleBackend,
  type VoiceConsoleBackend,
  type VoiceConsoleBackendStarterInput,
} from './voiceConsoleBackendStarter';
import { VOICE_CONSOLE_BACKEND_NOTE } from './voiceConsoleLiveSessionConfig';
import {
  type VoiceConsoleSendEvent,
  VoiceConsoleSidebandHandler,
} from './voiceConsoleSideband';

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const runClaudeHelp = (): string =>
  execFileSync('claude', ['--help'], {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

export const isClaudeEffortFlagSupported = (
  runHelp: () => string,
  logError: (message: string) => void,
): boolean => {
  try {
    return runHelp().includes('--effort');
  } catch (error) {
    logError(
      `claude --help failed; the voice console session runs without --effort: ${describeError(error)}`,
    );
    return false;
  }
};

export const createClaudeEffortFlagSupportCheck = (
  runHelp: () => string,
  logError: (message: string) => void,
): (() => boolean) => {
  let supported: boolean | null = null;
  return () => {
    if (supported !== null) {
      return supported;
    }
    supported = isClaudeEffortFlagSupported(runHelp, logError);
    return supported;
  };
};

export type ClaudeChildSpawnOptions = {
  env: Record<string, string>;
  stdio: ['pipe', 'pipe', 'pipe'];
};

export type ClaudeChildSpawnImplementation = (
  command: string,
  args: string[],
  options: ClaudeChildSpawnOptions,
) => ClaudeCodeChildProcess;

const nodeChildSpawn: ClaudeChildSpawnImplementation = (
  command,
  args,
  options,
) => nodeSpawn(command, args, options);

export const createClaudeChildSpawn = (
  spawnImplementation: ClaudeChildSpawnImplementation = nodeChildSpawn,
): ClaudeCodeSpawn => {
  return (command, args, env) =>
    spawnImplementation(command, args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
};

export const voiceConsoleProxyBaseUrl = (port: number): string =>
  `http://127.0.0.1:${port}`;

export const isVoiceConsoleProxyUp = async (input: {
  port: number;
  ensureProxyRunning: (port: number) => Promise<boolean>;
  logError: (message: string) => void;
}): Promise<boolean> => {
  try {
    return await input.ensureProxyRunning(input.port);
  } catch (error) {
    input.logError(
      `voice console could not start the token proxy; the Claude Code session runs without ANTHROPIC_BASE_URL: ${describeError(error)}`,
    );
    return false;
  }
};

export const selectVoiceConsoleOauthTokenForSession = (
  input: {
    loadSelectionSettings: () => LiveSessionOauthTokenSelectionSettings;
    tokenListJsonPath: string | null;
    cacheDirectory: string | null;
    nowEpochSeconds: number;
  },
  select: (
    handlerInput: LiveSessionOauthTokenSelectHandlerInput,
  ) => ClaudeCodeVoiceConsoleOauthTokenResult = (handlerInput) =>
    selectClaudeCodeVoiceConsoleOauthToken(handlerInput),
): ClaudeCodeVoiceConsoleOauthTokenResult => {
  let selectionSettings: LiveSessionOauthTokenSelectionSettings;
  try {
    selectionSettings = input.loadSelectionSettings();
  } catch (error) {
    return {
      error:
        'the fleet liveSessionOauthTokenSelection settings could not be loaded',
      diagnostics: [describeError(error)],
    };
  }
  return select({
    tokenListJsonPath: input.tokenListJsonPath,
    cacheDirectory: input.cacheDirectory,
    nowEpochSeconds: input.nowEpochSeconds,
    selectionSettings,
  });
};

export type VoiceConsoleSidebandConnector = {
  attach(
    sessionId: string,
    handleServerEvent: VoiceConsoleServerEventHandler,
    handleClosed?: () => void,
  ): Promise<void>;
};

export const attachVoiceConsoleBackend = async (input: {
  sideband: VoiceConsoleSidebandConnector;
  sessionId: string;
  startBackend: (
    appendCommentary: (delegationId: string, content: string) => void,
  ) => Promise<VoiceConsoleBackend>;
  newEventId: () => string;
  logError: (message: string) => void;
}): Promise<void> => {
  let currentSend: VoiceConsoleSendEvent | null = null;
  const backend = await input.startBackend((delegationId, content) => {
    if (currentSend === null) {
      throw new Error(
        `no sideband send is available to report delegation ${delegationId}`,
      );
    }
    currentSend({
      type: 'session.commentary.append',
      event_id: input.newEventId(),
      delegation_id: delegationId,
      content,
    });
  });
  let handler: VoiceConsoleSidebandHandler | null = null;
  try {
    await input.sideband.attach(
      input.sessionId,
      (event, send) => {
        currentSend = send;
        const activeHandler =
          handler ?? new VoiceConsoleSidebandHandler(backend, input.logError);
        handler = activeHandler;
        return activeHandler.handleServerEvent(event);
      },
      () => backend.stop(),
    );
  } catch (error) {
    backend.stop();
    throw error;
  }
};

export type VoiceConsoleBackendEnvironment = {
  resolveFleetConfigFilePath: (cliValue: string | null) => string | null;
  loadSelectionSettings: (
    fleetConfigFilePath: string | null,
  ) => LiveSessionOauthTokenSelectionSettings;
  resolveTokenListJsonPath: (explicitPath: string | null) => string | null;
  resolveCacheDirectory: (explicitDirectory: string | null) => string;
  readNowEpochSeconds: () => number;
  ensureProxyRunning: (port: number) => Promise<boolean>;
  proxyPort: number;
  effortFlagSupported: () => boolean;
  baseEnv: Record<string, string | undefined>;
  spawn: ClaudeCodeSpawn;
  logError: (message: string) => void;
};

export const buildVoiceConsoleBackendStartInput = (
  environment: VoiceConsoleBackendEnvironment,
  appendCommentary: (delegationId: string, content: string) => void,
): VoiceConsoleBackendStarterInput => ({
  selectOauthToken: () =>
    selectVoiceConsoleOauthTokenForSession({
      loadSelectionSettings: () =>
        environment.loadSelectionSettings(
          environment.resolveFleetConfigFilePath(null),
        ),
      tokenListJsonPath: environment.resolveTokenListJsonPath(null),
      cacheDirectory: environment.resolveCacheDirectory(null),
      nowEpochSeconds: environment.readNowEpochSeconds(),
    }),
  isProxyUp: () =>
    isVoiceConsoleProxyUp({
      port: environment.proxyPort,
      ensureProxyRunning: environment.ensureProxyRunning,
      logError: environment.logError,
    }),
  proxyBaseUrl: voiceConsoleProxyBaseUrl(environment.proxyPort),
  effortFlagSupported: environment.effortFlagSupported(),
  backendNote: VOICE_CONSOLE_BACKEND_NOTE,
  baseEnv: environment.baseEnv,
  spawn: environment.spawn,
  logError: environment.logError,
  appendCommentary,
});

export const attachVoiceConsoleBackendWithEnvironment = (input: {
  sideband: VoiceConsoleSidebandConnector;
  sessionId: string;
  environment: VoiceConsoleBackendEnvironment;
  newEventId: () => string;
  logError: (message: string) => void;
}): Promise<void> =>
  attachVoiceConsoleBackend({
    sideband: input.sideband,
    sessionId: input.sessionId,
    startBackend: (appendCommentary) =>
      startVoiceConsoleBackend(
        buildVoiceConsoleBackendStartInput(input.environment, appendCommentary),
      ),
    newEventId: input.newEventId,
    logError: input.logError,
  });
