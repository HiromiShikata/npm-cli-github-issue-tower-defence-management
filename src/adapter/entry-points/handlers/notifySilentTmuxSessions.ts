import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import {
  NotifySilentLiveSessionsUseCase,
  DEFAULT_EXCLUDED_STATUS,
  DEFAULT_SILENT_THRESHOLD_SECONDS,
  DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
} from '../../../domain/usecases/NotifySilentLiveSessionsUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { FileSystemSessionOutputActivityRepository } from '../../repositories/FileSystemSessionOutputActivityRepository';
import { TmuxSilentSessionNotificationRepository } from '../../repositories/TmuxSilentSessionNotificationRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';

export type NotifySilentTmuxSessionsParams = {
  project: Project;
  allowCacheMinutes: number;
  issueRepository: Pick<IssueRepository, 'getAllOpened'>;
  localCommandRunner: LocalCommandRunner;
  cacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
  sessionOutputRootDirectory: string | null;
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
    now,
  } = params;
  if (sessionOutputRootDirectory === null) {
    console.log(
      'Silent live session notification skipped: session output root directory is not configured.',
    );
    return;
  }
  const useCase = new NotifySilentLiveSessionsUseCase(
    issueRepository,
    new NodeTmuxSessionRepository(localCommandRunner),
    new FileSystemSessionOutputActivityRepository(sessionOutputRootDirectory),
    new TmuxSilentSessionNotificationRepository(
      localCommandRunner,
      cacheRepository,
    ),
  );
  await useCase.run({
    project,
    allowCacheMinutes,
    excludedStatus: DEFAULT_EXCLUDED_STATUS,
    silentThresholdSeconds: DEFAULT_SILENT_THRESHOLD_SECONDS,
    cooldownSeconds: DEFAULT_NOTIFICATION_COOLDOWN_SECONDS,
    now,
  });
};
