import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { InTmuxByHumanSessionReconcileUseCase } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';

export type ReconcileInTmuxByHumanSessionsParams = {
  project: Project;
  inTmuxLauncherCommand: string | null;
  assigneeLogin: string;
  issues: Issue[];
  localCommandRunner: LocalCommandRunner;
  issueStateRepository: Pick<IssueRepository, 'get'>;
  now: Date;
};

export const reconcileInTmuxByHumanSessions = async (
  params: ReconcileInTmuxByHumanSessionsParams,
): Promise<void> => {
  const {
    project,
    inTmuxLauncherCommand,
    assigneeLogin,
    issues,
    localCommandRunner,
    issueStateRepository,
    now,
  } = params;
  if (!inTmuxLauncherCommand || !assigneeLogin) {
    return;
  }
  const useCase = new InTmuxByHumanSessionReconcileUseCase(
    new NodeTmuxSessionRepository(localCommandRunner),
    issueStateRepository,
  );
  await useCase.run({
    project,
    issues,
    assigneeLogin,
    launcherCommand: inTmuxLauncherCommand,
    now,
  });
};
