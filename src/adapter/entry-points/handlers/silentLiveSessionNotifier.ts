import { Issue } from '../../../domain/entities/Issue';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { SilentLiveSessionNotifyUseCase } from '../../../domain/usecases/intmux/SilentLiveSessionNotifyUseCase';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';

export type NotifySilentLiveSessionsParams = {
  assigneeLogin: string;
  issues: Issue[];
  localCommandRunner: LocalCommandRunner;
  now: Date;
};

export const notifySilentLiveSessions = async (
  params: NotifySilentLiveSessionsParams,
): Promise<void> => {
  const { assigneeLogin, issues, localCommandRunner, now } = params;
  const useCase = new SilentLiveSessionNotifyUseCase(
    new NodeTmuxSessionRepository(localCommandRunner),
  );
  await useCase.run({ issues, assigneeLogin, now });
};
