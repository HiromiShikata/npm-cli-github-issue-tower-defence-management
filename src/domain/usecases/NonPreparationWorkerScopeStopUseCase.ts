import { Issue } from '../entities/Issue';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { PREPARATION_STATUS_NAME } from '../entities/WorkflowStatus';
import { resolveIssueForWorkerScopeUnitName } from './resolveIssueForWorkerScopeUnitName';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';

export class NonPreparationWorkerScopeStopUseCase {
  constructor(
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listRunningWorkerScopeUnitNames' | 'stopWorkerScopeUnit'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'get' | 'removeIssueFromProjectCache'
    >,
  ) {}

  run = async (params: {
    issues: Issue[];
    currentProjectOrg: string;
    project: Project;
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
      if (resolvedIssue.org !== params.currentProjectOrg) {
        console.warn(
          `[NonPreparationWorkerScopeStopUseCase] Skipped scope unit ${scopeUnitName}: resolved issue org "${resolvedIssue.org}" does not match current project org "${params.currentProjectOrg}" (resolvedIssue repo: ${resolvedIssue.repo}, url: ${resolvedIssue.url})`,
        );
        continue;
      }
      if (resolvedIssue.status === PREPARATION_STATUS_NAME) {
        continue;
      }
      let shouldStopScope = true;
      try {
        const staleness = await issueSnapshotStalenessCheck({
          issueRepository: this.issueRepository,
          project: params.project,
          snapshotIssue: resolvedIssue,
          checkedFieldNames: ['status'],
          skippedWriteDescription: `the worker scope stop of ${scopeUnitName}`,
        });
        if (
          (staleness.type === 'current' || staleness.type === 'stale') &&
          staleness.liveIssue.status === PREPARATION_STATUS_NAME
        ) {
          shouldStopScope = false;
        }
      } catch (error) {
        console.error(
          `[NonPreparationWorkerScopeStopUseCase] Failed to live re-check issue status before stopping scope unit ${scopeUnitName}, skipping the stop for this cycle: ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
        shouldStopScope = false;
      }
      if (!shouldStopScope) {
        continue;
      }
      await this.tmuxSessionRepository.stopWorkerScopeUnit(scopeUnitName);
      stoppedScopeUnitNames.push(scopeUnitName);
    }
    return { stoppedScopeUnitNames };
  };
}
