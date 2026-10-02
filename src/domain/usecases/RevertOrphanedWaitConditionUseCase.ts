import { PREPARATION_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import {
  Sleep,
  realSleep,
  commentCreateWithDedupRetry,
} from '../services/commentCreateWithDedupRetry';
import { isOrphanedWorkerProcess } from './isOrphanedWorkerProcess';
import { isAgentReportBody } from './isAgentReportBody';

export const ORPHANED_WAIT_CONDITION_REJECTION_DETAIL =
  'ORPHANED_WAIT_CONDITION';

export class RevertOrphanedWaitConditionUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues'>,
    readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    readonly localCommandRunner: LocalCommandRunner,
    readonly sleep: Sleep = realSleep,
  ) {}

  run = async (params: {
    projectUrl: string;
    preparationProcessCheckCommand: string;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
  }): Promise<void> => {
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
    const { issues } = await this.issueRepository.getAllIssues(projectId);

    const waitConditionIssues = issues.filter(
      (issue) =>
        issue.status !== PREPARATION_STATUS_NAME &&
        !issue.isPr &&
        (issue.dependedIssueUrls.length > 0 ||
          issue.nextActionDate !== null ||
          issue.nextActionHour !== null),
    );

    for (const issue of waitConditionIssues) {
      const isOrphaned = await isOrphanedWorkerProcess(
        issue,
        this.localCommandRunner,
        params,
      );
      if (!isOrphaned) {
        continue;
      }

      const comments =
        await this.issueCommentRepository.getCommentsFromIssue(issue);
      const lastComment = comments[comments.length - 1];
      if (lastComment && isAgentReportBody(lastComment.content)) {
        continue;
      }

      const rejectionStatusMessage = `Auto Status Check: REJECTED\n- ${ORPHANED_WAIT_CONDITION_REJECTION_DETAIL}`;

      await commentCreateWithDedupRetry(
        rejectionStatusMessage,
        async () => {
          const existing =
            await this.issueCommentRepository.getCommentsFromIssue(issue);
          return existing.map((c) => ({
            text: c.content,
            createdAt: c.createdAt,
          }));
        },
        async () => {
          await this.issueCommentRepository.createComment(
            issue,
            rejectionStatusMessage,
          );
        },
        () => new Date(),
        this.sleep,
        null,
      );
    }
  };
}
