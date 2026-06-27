import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
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
import { ProcessListSessionSubAgentActivityRepository } from '../../repositories/ProcessListSessionSubAgentActivityRepository';
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
  subAgentOutputRootDirectory: string | null;
  subAgentProcessMatchPattern: string | null;
  mainSilentThresholdSeconds: number;
  subAgentSilentThresholdSeconds: number;
  subAgentRunningThresholdSeconds: number;
  cooldownSeconds: number;
  staggerSeconds: number;
  messageTemplates: SilentSessionMessageTemplates;
  now: Date;
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
    subAgentOutputRootDirectory,
    subAgentProcessMatchPattern,
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
    subAgentProcessMatchPattern === null
  ) {
    console.log(
      'Silent live session notification skipped: neither session output root directory nor sub-agent process match pattern is configured.',
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
    new FileSystemSessionOutputActivityRepository(
      sessionOutputRootDirectory ?? '',
    ),
    new ProcessListSessionSubAgentActivityRepository(
      subAgentProcessMatchPattern,
      new NodeSubAgentProcessLister(localCommandRunner),
      new FileSystemSubAgentSilentSecondsResolver(
        subAgentOutputRootDirectory,
        now,
      ),
    ),
    new NoUnansweredOwnerCallStatusProvider(),
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
