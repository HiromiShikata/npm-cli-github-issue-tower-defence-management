import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { buildRelatedOpenPrUrlsByIssueUrl } from './buildRelatedOpenPrUrlsByIssueUrl';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
} from '../entities/WorkflowStatus';

const EXCLUDED_STATUSES = new Set([
  DONE_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
]);

export class ConflictedIssueRevertUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'getOpenPullRequests' | 'updateStatus' | 'updateBranch'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
  ) {}

  run = async (params: { projectUrl: string }): Promise<void> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      return;
    }

    const { issues } = await this.issueRepository.getAllIssues(projectId);

    const targetIssues = issues.filter(
      (issue) =>
        !issue.isPr &&
        (issue.status === null || !EXCLUDED_STATUSES.has(issue.status)),
    );

    const relatedOpenPrUrlsByIssueUrl =
      buildRelatedOpenPrUrlsByIssueUrl(issues);

    const allPrUrls = Array.from(
      new Set(
        targetIssues.flatMap(
          (issue) => relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [],
        ),
      ),
    );

    if (allPrUrls.length === 0) {
      return;
    }

    const resolvedPrByUrl =
      await this.issueRepository.getOpenPullRequests(allPrUrls);

    for (const issue of targetIssues) {
      const prUrls = relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [];
      if (prUrls.length === 0) {
        continue;
      }

      const relatedPrs = prUrls
        .map((url) => resolvedPrByUrl.get(url) ?? null)
        .filter((pr): pr is NonNullable<typeof pr> => pr !== null);

      const hasUnknownMergeable = relatedPrs.some(
        (pr) => pr.mergeable === 'UNKNOWN',
      );
      if (hasUnknownMergeable) {
        continue;
      }

      const conflictedPrs = relatedPrs.filter((pr) => pr.isConflicted);
      if (conflictedPrs.length === 0) {
        continue;
      }

      const allBranchesUpdated = (
        await Promise.all(
          conflictedPrs.map((pr) => this.issueRepository.updateBranch(pr.url)),
        )
      ).every(Boolean);
      if (allBranchesUpdated) {
        continue;
      }

      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.issueCommentRepository.createComment(issue, 'conflict');
    }
  };
}
