import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import {
  SessionOutputDegenerationRecoveryUseCase,
  DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS,
  DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS,
  DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE,
} from '../../../domain/usecases/SessionOutputDegenerationRecoveryUseCase';
import { LocalProcessLiveSessionProcessSnapshotProvider } from '../../repositories/LocalProcessLiveSessionProcessSnapshotProvider';
import { ProcFsProcessEnvironReader } from '../../repositories/ProcFsProcessEnvironReader';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from '../../repositories/FileSystemInteractiveLiveSessionTranscriptResolver';
import { FileSystemSessionAssistantTurnsRepository } from '../../repositories/FileSystemSessionAssistantTurnsRepository';
import { FileSystemSessionDegenerationCooldownStateRepository } from '../../repositories/FileSystemSessionDegenerationCooldownStateRepository';
import { TmuxSilentSessionNotificationRepository } from '../../repositories/TmuxSilentSessionNotificationRepository';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { RealSleeper } from '../../repositories/RealSleeper';

export type ResetDegeneratedTmuxSessionsParams = {
  enabled: boolean;
  localCommandRunner: LocalCommandRunner;
  processEnvironReader?: ProcessEnvironReader;
  warningMessage: string;
  graceSeconds: number;
  cooldownSeconds: number;
  cooldownStateFilePath: string | null;
  now: Date;
};

export const resetDegeneratedTmuxSessions = async (
  params: ResetDegeneratedTmuxSessionsParams,
): Promise<void> => {
  const {
    enabled,
    localCommandRunner,
    processEnvironReader,
    warningMessage,
    graceSeconds,
    cooldownSeconds,
    cooldownStateFilePath,
    now,
  } = params;
  const useCase = new SessionOutputDegenerationRecoveryUseCase(
    new LocalProcessLiveSessionProcessSnapshotProvider(
      localCommandRunner,
      processEnvironReader ?? new ProcFsProcessEnvironReader(),
    ),
    new FileSystemInteractiveLiveSessionTranscriptResolver(),
    new FileSystemSessionAssistantTurnsRepository(),
    new TmuxSilentSessionNotificationRepository(
      localCommandRunner,
      new RealSleeper(),
    ),
    new NodeTmuxSessionRepository(localCommandRunner),
    cooldownStateFilePath !== null
      ? new FileSystemSessionDegenerationCooldownStateRepository(
          cooldownStateFilePath,
        )
      : new FileSystemSessionDegenerationCooldownStateRepository(),
    new RealSleeper(),
  );
  await useCase.run({
    enabled,
    warningMessage,
    graceSeconds,
    cooldownSeconds,
    now,
  });
};

export const DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS = {
  warningMessage: DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE,
  graceSeconds: DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS,
  cooldownSeconds: DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS,
} as const;
