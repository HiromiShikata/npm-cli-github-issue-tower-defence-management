import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DONE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  IN_TMUX_STATUS_NAME,
} from '../entities/WorkflowStatus';

const EXCLUDED_STATUSES = new Set([
  AWAITING_WORKSPACE_STATUS_NAME,
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
      'getAllIssues' | 'getOpenPullRequests' | 'updateStatus'
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

    const targetTaskIssues = issues.filter(
      (issue) =>
        !issue.isPr &&
        !issue.isClosed &&
        issue.status !== null &&
        !EXCLUDED_STATUSES.has(issue.status),
    );

    const openPrUrlsByIssueUrl = new Map<string, Set<string>>();
    for (const issue of issues) {
      if (!issue.isPr || issue.isClosed) {
        continue;
      }
      for (const referencedIssueUrl of issue.closingIssueReferenceUrls) {
        const existing = openPrUrlsByIssueUrl.get(referencedIssueUrl);
        if (existing) {
          existing.add(issue.url);
        } else {
          openPrUrlsByIssueUrl.set(referencedIssueUrl, new Set([issue.url]));
        }
      }
    }

    const allPrUrls = Array.from(
      new Set(
        targetTaskIssues.flatMap((issue) =>
          Array.from(openPrUrlsByIssueUrl.get(issue.url) ?? []),
        ),
      ),
    );

    const prDetailsByUrl =
      await this.issueRepository.getOpenPullRequests(allPrUrls);

    for (const issue of targetTaskIssues) {
      const linkedPrUrls = Array.from(
        openPrUrlsByIssueUrl.get(issue.url) ?? [],
      );
      if (linkedPrUrls.length === 0) {
        continue;
      }

      const linkedPrDetails = linkedPrUrls
        .map((url) => prDetailsByUrl.get(url) ?? null)
        .filter((pr) => pr !== null);

      const hasUnknownMergeable = linkedPrDetails.some(
        (pr) => pr.mergeable === 'UNKNOWN',
      );
      if (hasUnknownMergeable) {
        continue;
      }

      const hasConflictedPr = linkedPrDetails.some((pr) => pr.isConflicted);
      if (!hasConflictedPr) {
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
