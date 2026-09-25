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
    const errors: unknown[] = [];
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
      try {
        await this.tmuxSessionRepository.stopWorkerScopeUnit(scopeUnitName);
        stoppedScopeUnitNames.push(scopeUnitName);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to stop ${errors.length} worker scope unit(s) whose issue Status is not ${PREPARATION_STATUS_NAME}`,
      );
    }
    return { stoppedScopeUnitNames };
  };
}
