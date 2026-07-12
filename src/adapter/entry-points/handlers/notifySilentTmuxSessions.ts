import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { SessionSubAgentActivityRepository } from '../../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { OwnerCallStatusProvider } from '../../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import {
  NotifySilentLiveSessionsUseCase,
  HubTaskStatusResolver,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  DEFAULT_SUBAGENT_REMINDER_ESCALATION_SECONDS,
  DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} from '../../../domain/usecases/NotifySilentLiveSessionsUseCase';
import { DefaultSilentSessionMessageComposer } from '../../../domain/usecases/DefaultSilentSessionMessageComposer';
import { LocalProcessLiveSessionProcessSnapshotProvider } from '../../repositories/LocalProcessLiveSessionProcessSnapshotProvider';
import { ProcFsProcessEnvironReader } from '../../repositories/ProcFsProcessEnvironReader';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from '../../repositories/FileSystemInteractiveLiveSessionTranscriptResolver';
import { FileSystemSessionOutputActivityRepository } from '../../repositories/FileSystemSessionOutputActivityRepository';
import { TmuxSilentSessionNotificationRepository } from '../../repositories/TmuxSilentSessionNotificationRepository';
import { NoUnansweredOwnerCallStatusProvider } from '../../repositories/NoUnansweredOwnerCallStatusProvider';
import { TranscriptOwnerCallStatusProvider } from '../../repositories/TranscriptOwnerCallStatusProvider';
import { ProcessListSessionSubAgentActivityRepository } from '../../repositories/ProcessListSessionSubAgentActivityRepository';
import { TranscriptSessionSubAgentActivityRepository } from '../../repositories/TranscriptSessionSubAgentActivityRepository';
import { FileSystemSubAgentTranscriptDirectoryResolver } from '../../repositories/FileSystemSubAgentTranscriptDirectoryResolver';
import { NodeSubAgentProcessLister } from '../../repositories/NodeSubAgentProcessLister';
import { FileSystemSubAgentSilentSecondsResolver } from '../../repositories/FileSystemSubAgentSilentSecondsResolver';
import {
  ConfigurableSilentSessionMessageComposer,
  SilentSessionMessageTemplates,
} from '../../repositories/ConfigurableSilentSessionMessageComposer';
import { RealSleeper } from '../../repositories/RealSleeper';
import { FileSystemSilentSessionCandidateStateRepository } from '../../repositories/FileSystemSilentSessionCandidateStateRepository';
import { FileSystemSilentSessionHubTaskStatusCacheRepository } from '../../repositories/FileSystemSilentSessionHubTaskStatusCacheRepository';

export type NotifySilentTmuxSessionsParams = {
  enabled: boolean;
  localCommandRunner: LocalCommandRunner;
  processEnvironReader?: ProcessEnvironReader;
  ownerCallMarker: string | null;
  subAgentOutputRootDirectory: string | null;
  subAgentProcessMatchPattern: string | null;
  subAgentTranscriptRootDirectory: string | null;
  mainSilentThresholdSeconds: number;
  subAgentSilentThresholdSeconds: number;
  subAgentRunningThresholdSeconds: number;
  staggerSeconds: number;
  candidateDebounceRecencyWindowSeconds: number;
  subAgentReminderEscalationSeconds: number;
  candidateDebounceStateFilePath: string | null;
  activeHubTaskStatus: string | null;
  hubTaskStatusResolver: HubTaskStatusResolver | null;
  hubTaskStatusCacheStateFilePath: string | null;
  hubTaskStatusCacheTtlSeconds: number;
  messageTemplates: SilentSessionMessageTemplates;
  now: Date;
};

const createOwnerCallStatusProvider = (
  ownerCallMarker: string | null,
): OwnerCallStatusProvider => {
  if (ownerCallMarker !== null && ownerCallMarker.length > 0) {
    return new TranscriptOwnerCallStatusProvider(ownerCallMarker);
  }
  return new NoUnansweredOwnerCallStatusProvider();
};

const createSubAgentActivityRepository = (
  subAgentTranscriptRootDirectory: string | null,
  subAgentProcessMatchPattern: string | null,
  subAgentOutputRootDirectory: string | null,
  localCommandRunner: LocalCommandRunner,
  now: Date,
): SessionSubAgentActivityRepository => {
  if (subAgentTranscriptRootDirectory !== null) {
    return new TranscriptSessionSubAgentActivityRepository(
      new FileSystemSubAgentTranscriptDirectoryResolver(
        subAgentTranscriptRootDirectory,
      ),
      now,
    );
  }
  return new ProcessListSessionSubAgentActivityRepository(
    subAgentProcessMatchPattern,
    new NodeSubAgentProcessLister(localCommandRunner),
    new FileSystemSubAgentSilentSecondsResolver(
      subAgentOutputRootDirectory,
      now,
    ),
  );
};

export const notifySilentTmuxSessions = async (
  params: NotifySilentTmuxSessionsParams,
): Promise<void> => {
  const {
    enabled,
    localCommandRunner,
    processEnvironReader,
    ownerCallMarker,
    subAgentOutputRootDirectory,
    subAgentProcessMatchPattern,
    subAgentTranscriptRootDirectory,
    mainSilentThresholdSeconds,
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    staggerSeconds,
    candidateDebounceRecencyWindowSeconds,
    subAgentReminderEscalationSeconds,
    candidateDebounceStateFilePath,
    activeHubTaskStatus,
    hubTaskStatusResolver,
    hubTaskStatusCacheStateFilePath,
    hubTaskStatusCacheTtlSeconds,
    messageTemplates,
    now,
  } = params;
  if (!enabled) {
    console.log(
      'Silent live session notification skipped: not enabled (set silentNotificationEnabled or TDPM_SILENT_NOTIFICATION_ENABLED=true to enable).',
    );
    return;
  }
  const messageComposer = new ConfigurableSilentSessionMessageComposer(
    messageTemplates,
    new DefaultSilentSessionMessageComposer(ownerCallMarker),
    ownerCallMarker,
  );
  const useCase = new NotifySilentLiveSessionsUseCase(
    new LocalProcessLiveSessionProcessSnapshotProvider(
      localCommandRunner,
      processEnvironReader ?? new ProcFsProcessEnvironReader(),
    ),
    new FileSystemInteractiveLiveSessionTranscriptResolver(),
    new FileSystemSessionOutputActivityRepository(),
    createSubAgentActivityRepository(
      subAgentTranscriptRootDirectory,
      subAgentProcessMatchPattern,
      subAgentOutputRootDirectory,
      localCommandRunner,
      now,
    ),
    createOwnerCallStatusProvider(ownerCallMarker),
    new TmuxSilentSessionNotificationRepository(localCommandRunner),
    candidateDebounceStateFilePath !== null
      ? new FileSystemSilentSessionCandidateStateRepository(
          candidateDebounceStateFilePath,
        )
      : new FileSystemSilentSessionCandidateStateRepository(),
    messageComposer,
    new RealSleeper(),
    hubTaskStatusResolver,
    hubTaskStatusCacheStateFilePath !== null
      ? new FileSystemSilentSessionHubTaskStatusCacheRepository(
          hubTaskStatusCacheStateFilePath,
        )
      : new FileSystemSilentSessionHubTaskStatusCacheRepository(),
  );
  await useCase.run({
    mainSilentThresholdSeconds,
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    staggerSeconds,
    candidateDebounceRecencyWindowSeconds,
    subAgentReminderEscalationSeconds,
    activeHubTaskStatus,
    hubTaskStatusCacheTtlSeconds,
    now,
  });
};

export const DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {
  mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  candidateDebounceRecencyWindowSeconds:
    DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  subAgentReminderEscalationSeconds:
    DEFAULT_SUBAGENT_REMINDER_ESCALATION_SECONDS,
  hubTaskStatusCacheTtlSeconds: DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} as const;
