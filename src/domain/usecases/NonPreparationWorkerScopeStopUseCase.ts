import { Issue } from '../entities/Issue';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { PREPARATION_STATUS_NAME } from '../entities/WorkflowStatus';
import { resolveIssueForWorkerScopeUnitName } from './resolveIssueForWorkerScopeUnitName';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';
import {
  issueBelongsToProjectScope,
  ProjectRepositoryScope,
} from '../services/projectRepositoryScope';

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
    projectScope?: ProjectRepositoryScope | null;
  }): Promise<{ stoppedScopeUnitNames: string[] }> => {
    const runningScopeUnitNames =
      await this.tmuxSessionRepository.listRunningWorkerScopeUnitNames();

    const stoppedScopeUnitNames: string[] = [];
    const stopErrors: unknown[] = [];
    for (const scopeUnitName of runningScopeUnitNames) {
      const resolvedIssue = resolveIssueForWorkerScopeUnitName(
        scopeUnitName,
        params.issues,
      );
      if (resolvedIssue === null) {
        continue;
      }
      const belongsToProject =
        params.projectScope === undefined || params.projectScope === null
          ? resolvedIssue.org === params.currentProjectOrg
          : issueBelongsToProjectScope(
              { owner: resolvedIssue.org, repo: resolvedIssue.repo },
              params.projectScope,
            );
      if (!belongsToProject) {
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
      try {
        await this.tmuxSessionRepository.stopWorkerScopeUnit(scopeUnitName);
        stoppedScopeUnitNames.push(scopeUnitName);
      } catch (error) {
        console.error(
          `[NonPreparationWorkerScopeStopUseCase] Failed to stop scope unit ${scopeUnitName}: ${error instanceof Error ? error.message : String(error)}`,
          error,
        );
        stopErrors.push(error);
      }
    }
    if (stopErrors.length === 1) throw stopErrors[0];
    if (stopErrors.length > 1)
      throw new Error(stopErrors.map(String).join('; '));
    return { stoppedScopeUnitNames };
  };
}
