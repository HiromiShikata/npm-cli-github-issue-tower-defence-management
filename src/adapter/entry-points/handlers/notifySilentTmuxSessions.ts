import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { SessionSubAgentActivityRepository } from '../../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { OwnerCallStatusProvider } from '../../../domain/usecases/adapter-interfaces/OwnerCallStatusProvider';
import {
  NotifySilentLiveSessionsUseCase,
  DEFAULT_MONITORED_STATUS,
  DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  DEFAULT_NOTIFICATION_STAGGER_SECONDS,
} from '../../../domain/usecases/NotifySilentLiveSessionsUseCase';
import { DefaultSilentSessionMessageComposer } from '../../../domain/usecases/DefaultSilentSessionMessageComposer';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { FileSystemSessionOutputActivityRepository } from '../../repositories/FileSystemSessionOutputActivityRepository';
import { TmuxSilentSessionNotificationRepository } from '../../repositories/TmuxSilentSessionNotificationRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
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

export type NotifySilentTmuxSessionsParams = {
  project: Project;
  allowCacheMinutes: number;
  issueRepository: Pick<IssueRepository, 'getAllOpened'>;
  localCommandRunner: LocalCommandRunner;
  cacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
  sessionOutputRootDirectory: string | null;
  sessionTranscriptRootDirectory: string | null;
  ownerCallMarker: string | null;
  subAgentOutputRootDirectory: string | null;
  subAgentProcessMatchPattern: string | null;
  subAgentTranscriptRootDirectory: string | null;
  mainSilentThresholdSeconds: number;
  subAgentSilentThresholdSeconds: number;
  subAgentRunningThresholdSeconds: number;
  cooldownSeconds: number;
  staggerSeconds: number;
  messageTemplates: SilentSessionMessageTemplates;
  now: Date;
};

const createOwnerCallStatusProvider = (
  sessionTranscriptRootDirectory: string | null,
  ownerCallMarker: string | null,
): OwnerCallStatusProvider => {
  if (
    sessionTranscriptRootDirectory !== null &&
    ownerCallMarker !== null &&
    ownerCallMarker.length > 0
  ) {
    return new TranscriptOwnerCallStatusProvider(
      sessionTranscriptRootDirectory,
      ownerCallMarker,
    );
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
    project,
    allowCacheMinutes,
    issueRepository,
    localCommandRunner,
    cacheRepository,
    sessionOutputRootDirectory,
    sessionTranscriptRootDirectory,
    ownerCallMarker,
    subAgentOutputRootDirectory,
    subAgentProcessMatchPattern,
    subAgentTranscriptRootDirectory,
    mainSilentThresholdSeconds,
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    cooldownSeconds,
    staggerSeconds,
    messageTemplates,
    now,
  } = params;
  if (
    sessionOutputRootDirectory === null &&
    subAgentProcessMatchPattern === null &&
    subAgentTranscriptRootDirectory === null
  ) {
    console.log(
      'Silent live session notification skipped: no session output root directory, sub-agent process match pattern, or sub-agent transcript root directory is configured.',
    );
    return;
  }
  const messageComposer = new ConfigurableSilentSessionMessageComposer(
    messageTemplates,
    new DefaultSilentSessionMessageComposer(),
  );
  const useCase = new NotifySilentLiveSessionsUseCase(
    issueRepository,
    new NodeTmuxSessionRepository(localCommandRunner),
    new FileSystemSessionOutputActivityRepository(sessionOutputRootDirectory),
    createSubAgentActivityRepository(
      subAgentTranscriptRootDirectory,
      subAgentProcessMatchPattern,
      subAgentOutputRootDirectory,
      localCommandRunner,
      now,
    ),
    createOwnerCallStatusProvider(
      sessionTranscriptRootDirectory,
      ownerCallMarker,
    ),
    new TmuxSilentSessionNotificationRepository(
      localCommandRunner,
      cacheRepository,
    ),
    messageComposer,
    new RealSleeper(),
  );
  await useCase.run({
    project,
    allowCacheMinutes,
    monitoredStatus: DEFAULT_MONITORED_STATUS,
    mainSilentThresholdSeconds,
    subAgentSilentThresholdSeconds,
    subAgentRunningThresholdSeconds,
    cooldownSeconds,
    staggerSeconds,
    now,
  });
};

export const DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS = {
  mainSilentThresholdSeconds: DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS,
  subAgentSilentThresholdSeconds: DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS,
  subAgentRunningThresholdSeconds: DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS,
  cooldownSeconds: DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
  staggerSeconds: DEFAULT_NOTIFICATION_STAGGER_SECONDS,
} as const;
