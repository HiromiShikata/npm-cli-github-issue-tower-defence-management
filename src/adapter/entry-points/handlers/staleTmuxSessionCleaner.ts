import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import {
  StaleTmuxSessionKillUseCase,
  DEFAULT_EXCLUDED_STATUS,
  DEFAULT_IDLE_THRESHOLD_SECONDS,
} from '../../../domain/usecases/StaleTmuxSessionKillUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';

export type CleanStaleTmuxSessionsParams = {
  project: Project;
  issueRepository: Pick<IssueRepository, 'getAllOpened'>;
  localCommandRunner: LocalCommandRunner;
  now: Date;
};

export const cleanStaleTmuxSessions = async (
  params: CleanStaleTmuxSessionsParams,
): Promise<void> => {
  const { project, issueRepository, localCommandRunner, now } = params;
  const useCase = new StaleTmuxSessionKillUseCase(
    issueRepository,
    new NodeTmuxSessionRepository(localCommandRunner),
  );
  await useCase.run({
    project,
    excludedStatus: DEFAULT_EXCLUDED_STATUS,
    idleThresholdSeconds: DEFAULT_IDLE_THRESHOLD_SECONDS,
    now,
  });
};
