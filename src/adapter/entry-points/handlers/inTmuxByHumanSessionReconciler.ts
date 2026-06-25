import { Issue } from '../../../domain/entities/Issue';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { InTmuxByHumanSessionReconcileUseCase } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';

export type ReconcileInTmuxByHumanSessionsParams = {
  inTmuxLauncherCommand: string | null;
  assigneeLogin: string;
  issues: Issue[];
  localCommandRunner: LocalCommandRunner;
  now: Date;
};

export const reconcileInTmuxByHumanSessions = async (
  params: ReconcileInTmuxByHumanSessionsParams,
): Promise<void> => {
  const {
    inTmuxLauncherCommand,
    assigneeLogin,
    issues,
    localCommandRunner,
    now,
  } = params;
  if (!inTmuxLauncherCommand || !assigneeLogin) {
    return;
  }
  const useCase = new InTmuxByHumanSessionReconcileUseCase(
    new NodeTmuxSessionRepository(localCommandRunner),
  );
  await useCase.run({
    issues,
    assigneeLogin,
    launcherCommand: inTmuxLauncherCommand,
    now,
  });
};
