import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { SessionSubAgentActivityRepository } from '../../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import {
  NotifySilentLiveSessionsUseCase,
  HubTaskStatusResolver,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} from '../../../domain/usecases/NotifySilentLiveSessionsUseCase';
import { DefaultSilentSessionMessageComposer } from '../../../domain/usecases/DefaultSilentSessionMessageComposer';
import { LocalProcessLiveSessionProcessSnapshotProvider } from '../../repositories/LocalProcessLiveSessionProcessSnapshotProvider';
import { ProcFsProcessEnvironReader } from '../../repositories/ProcFsProcessEnvironReader';
import { FileSystemInteractiveLiveSessionTranscriptResolver } from '../../repositories/FileSystemInteractiveLiveSessionTranscriptResolver';
import {
  DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT,
  DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS,
  TmuxSilentSessionNotificationRepository,
} from '../../repositories/TmuxSilentSessionNotificationRepository';
import { TranscriptRefusalTailStatusProvider } from '../../repositories/TranscriptRefusalTailStatusProvider';
import { ProcessListSessionSubAgentActivityRepository } from '../../repositories/ProcessListSessionSubAgentActivityRepository';
import { TranscriptSessionSubAgentActivityRepository } from '../../repositories/TranscriptSessionSubAgentActivityRepository';
import { FileSystemSubAgentTranscriptDirectoryResolver } from '../../repositories/FileSystemSubAgentTranscriptDirectoryResolver';
import { FileSystemSubAgentLivenessResolver } from '../../repositories/FileSystemSubAgentLivenessResolver';
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
  subAgentOutputRootDirectory: string | null;
  subAgentProcessMatchPattern: string | null;
  subAgentTranscriptRootDirectory: string | null;
  subAgentRuntimeRootDirectory: string | null;
  subAgentSilentThresholdSeconds: number;
  subAgentRunningThresholdSeconds: number;
  staggerSeconds: number;
  candidateDebounceRecencyWindowSeconds: number;
  candidateDebounceStateFilePath: string | null;
  activeHubTaskStatus: string | null;
  hubTaskStatusResolver: HubTaskStatusResolver | null;
  hubTaskStatusCacheStateFilePath: string | null;
  hubTaskStatusCacheTtlSeconds: number;
  messageTemplates: SilentSessionMessageTemplates;
  submitPushOutWaitMilliseconds?: number;
  now: Date;
};

const createSubAgentActivityRepository = (
  subAgentTranscriptRootDirectory: string | null,
  subAgentRuntimeRootDirectory: string | null,
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
      new NodeSubAgentProcessLister(localCommandRunner),
      now,
      new FileSystemSubAgentLivenessResolver(subAgentRuntimeRootDirectory),
      subAgentRuntimeRootDirectory,
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
    subAgentOutputRootDirectory,
    subAgentProcessMatchPattern,
    subAgentTranscriptRootDirectory,
    subAgentRuntimeRootDirectory,
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    staggerSeconds,
    candidateDebounceRecencyWindowSeconds,
    candidateDebounceStateFilePath,
    activeHubTaskStatus,
    hubTaskStatusResolver,
    hubTaskStatusCacheStateFilePath,
    hubTaskStatusCacheTtlSeconds,
    messageTemplates,
    submitPushOutWaitMilliseconds,
    now,
  } = params;
  if (!enabled) {
    console.log(
      'Silent live session notification skipped: not enabled (set silentNotificationEnabled in fleet config, in project config, or set TDPM_SILENT_NOTIFICATION_ENABLED=true).',
    );
    return;
  }
  const messageComposer = new ConfigurableSilentSessionMessageComposer(
    messageTemplates,
    new DefaultSilentSessionMessageComposer(),
  );
  const useCase = new NotifySilentLiveSessionsUseCase(
    new LocalProcessLiveSessionProcessSnapshotProvider(
      localCommandRunner,
      processEnvironReader ?? new ProcFsProcessEnvironReader(),
    ),
    new FileSystemInteractiveLiveSessionTranscriptResolver(),
    createSubAgentActivityRepository(
      subAgentTranscriptRootDirectory,
      subAgentRuntimeRootDirectory,
      subAgentProcessMatchPattern,
      subAgentOutputRootDirectory,
      localCommandRunner,
      now,
    ),
    new TmuxSilentSessionNotificationRepository(
      localCommandRunner,
      new RealSleeper(),
      DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT,
      submitPushOutWaitMilliseconds ??
        DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS,
    ),
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
    new TranscriptRefusalTailStatusProvider(),
  );
  await useCase.run({
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    staggerSeconds,
    candidateDebounceRecencyWindowSeconds,
    activeHubTaskStatus,
    hubTaskStatusCacheTtlSeconds,
    now,
  });
};

export const DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {
  subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
  candidateDebounceRecencyWindowSeconds:
    DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS,
  hubTaskStatusCacheTtlSeconds: DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS,
} as const;
