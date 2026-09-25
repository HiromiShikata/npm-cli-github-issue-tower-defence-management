import { Issue } from '../entities/Issue';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { PREPARATION_STATUS_NAME } from '../entities/WorkflowStatus';
import { resolveIssueForWorkerScopeUnitName } from './resolveIssueForWorkerScopeUnitName';

export class NonPreparationWorkerScopeStopUseCase {
  constructor(
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listRunningWorkerScopeUnitNames' | 'stopWorkerScopeUnit'
    >,
  ) {}

  run = async (params: {
    issues: Issue[];
  }): Promise<{ stoppedScopeUnitNames: string[] }> => {
    const runningScopeUnitNames =
      await this.tmuxSessionRepository.listRunningWorkerScopeUnitNames();

    const stoppedScopeUnitNames: string[] = [];
    for (const scopeUnitName of runningScopeUnitNames) {
      const resolvedIssue = resolveIssueForWorkerScopeUnitName(
        scopeUnitName,
        params.issues,
      );
      if (resolvedIssue === null) {
        continue;
      }
      if (resolvedIssue.status === PREPARATION_STATUS_NAME) {
        continue;
      }
      await this.tmuxSessionRepository.stopWorkerScopeUnit(scopeUnitName);
      stoppedScopeUnitNames.push(scopeUnitName);
    }
    return { stoppedScopeUnitNames };
  };
}
