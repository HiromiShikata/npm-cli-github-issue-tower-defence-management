import {
  IssueRepository,
  RelatedPullRequest,
} from './adapter-interfaces/IssueRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { Comment } from '../entities/Comment';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import { isPullRequestDeclaredUnnecessary } from './isPullRequestDeclaredUnnecessary';
import { dropTrailingAutoStatusCheckComments } from './autoStatusCheckComments';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import {
  RETURNED_TO_AWAITING_WORKSPACE_MESSAGE,
  RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD,
} from './returnedToAwaitingWorkspaceMessage';
import { extractNextStepAgent } from './extractNextStepAgent';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';

const ORPHANED_PREPARATION_REJECTION_DETAIL = 'ORPHANED_PREPARATION';

type OrphanedPreparationOutcome =
  'advanceToQualityCheck' | 'returnToLabelSelectedAgent' | 'reject';

export class RevertOrphanedPreparationUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      | 'findProjectIdByUrl'
      | 'getProject'
      | 'createField'
      | 'getByUrl'
      | 'updateAgentList'
    >,
    readonly issueRepository: Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
      | 'get'
      | 'setIssueAgentField'
    >,
    readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    readonly localCommandRunner: LocalCommandRunner,
  ) {}

  run = async (params: {
    projectUrl: string;
    preparationProcessCheckCommand: string;
    thresholdForAutoReject: number;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
    awaitingQualityCheckStatus?: string | null;
    labelsAsLlmAgentName?: string[] | null;
    labelsNotRequiringPullRequest?: string[] | null;
    allowedIssueAuthors?: string[] | null;
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

    const preparationIssues = issues.filter(
      (issue) => issue.status === PREPARATION_STATUS_NAME,
    );

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      return;
    }

    const resolvedQualityCheckStatusName =
      params.awaitingQualityCheckStatus ?? AWAITING_QUALITY_CHECK_STATUS_NAME;
    const awaitingQualityCheckStatusOption = project.status.statuses.find(
      (s) => s.name === resolvedQualityCheckStatusName,
    );

    const failedPreparationStatusOption = project.status.statuses.find(
      (s) => s.name === FAILED_PREPARATION_STATUS_NAME,
    );

    for (const issue of preparationIssues) {
      const isOrphaned = await this.isOrphanedIssue(issue, params);
      if (!isOrphaned) {
        continue;
      }
      const { outcome, comments } = await this.evaluateOutcome(
        issue,
        resolveLabelsNotRequiringPullRequest(params),
        params.allowedIssueAuthors,
      );
      const isStillInPreparation = await this.isStillInPreparation(
        issue,
        project,
      );
      if (!isStillInPreparation) {
        continue;
      }
      const nextStepAgent = this.resolveNextStepAgent(comments);
      if (nextStepAgent !== null) {
        const agentOptionId = await ensureAgentOptionAndGetId(
          this.projectRepository,
          project,
          nextStepAgent,
        );
        if (agentOptionId !== null) {
          await this.issueRepository.setIssueAgentField(
            issue.url,
            project,
            agentOptionId,
          );
        }
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        continue;
      }
      if (outcome === 'returnToLabelSelectedAgent') {
        await this.issueRepository.updateStatus(
          project,
          issue,
          awaitingWorkspaceStatusOption.id,
        );
        await this.issueCommentRepository.createComment(
          issue,
          RETURNED_TO_AWAITING_WORKSPACE_MESSAGE,
        );
        continue;
      }
      if (outcome === 'advanceToQualityCheck') {
        if (awaitingQualityCheckStatusOption) {
          await this.issueRepository.updateStatus(
            project,
            issue,
            awaitingQualityCheckStatusOption.id,
          );
        } else {
          await this.issueRepository.updateStatus(
            project,
            issue,
            awaitingWorkspaceStatusOption.id,
          );
        }
        continue;
      }

      const rejectionStatusMessage = `Auto Status Check: REJECTED\n- ${ORPHANED_PREPARATION_REJECTION_DETAIL}`;
      const lastTargetComments = comments.slice(
        -params.thresholdForAutoReject * 2,
      );
      const rejectionCommentCount = lastTargetComments.filter((comment) =>
        comment.content.startsWith('Auto Status Check: REJECTED'),
      ).length;
      const alreadyEscalated = lastTargetComments.some((comment) =>
        comment.content
          .toLowerCase()
          .includes('failed to pass the check automatically'),
      );

      if (
        failedPreparationStatusOption &&
        rejectionCommentCount + 1 >= params.thresholdForAutoReject &&
        !alreadyEscalated
      ) {
        await this.issueRepository.updateStatus(
          project,
          issue,
          failedPreparationStatusOption.id,
        );
        await this.issueCommentRepository.createComment(
          issue,
          `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`,
        );
        continue;
      }

      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.issueCommentRepository.createComment(
        issue,
        rejectionStatusMessage,
      );
    }
  };

  private isStillInPreparation = async (
    issue: Issue,
    project: Project,
  ): Promise<boolean> => {
    let liveIssue: Issue | null;
    try {
      liveIssue = await this.issueRepository.get(issue.url, project);
    } catch (error) {
      console.error(
        `Failed to re-read the live status before reverting orphaned preparation. issueUrl: ${issue.url}`,
        error,
      );
      return false;
    }
    if (liveIssue === null) {
      console.error(
        `Issue not found while re-reading its live status before reverting orphaned preparation. issueUrl: ${issue.url}`,
      );
      return false;
    }
    return liveIssue.status === PREPARATION_STATUS_NAME;
  };

  private evaluateOutcome = async (
    issue: Issue,
    labelsNotRequiringPullRequest: string[],
    allowedIssueAuthors: string[] | null | undefined,
  ): Promise<{
    outcome: OrphanedPreparationOutcome;
    comments: Comment[];
  }> => {
    if (issue.isClosed) {
      return { outcome: 'advanceToQualityCheck', comments: [] };
    }
    let comments: Comment[];
    try {
      comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
    } catch (error) {
      console.error(
        `Failed to fetch comments for orphaned preparation issue ${issue.url}, reverting to Awaiting Workspace:`,
        error,
      );
      return { outcome: 'reject', comments: [] };
    }
    const isTrustedAuthor = (author: string): boolean =>
      isAuthorAuthorizedForAutoStatusCheck(author, allowedIssueAuthors);
    const commentsBeforeOwnStatusComments = dropTrailingAutoStatusCheckComments(
      comments,
      isTrustedAuthor,
    );
    const lastReport =
      commentsBeforeOwnStatusComments[
        commentsBeforeOwnStatusComments.length - 1
      ] ?? null;
    if (
      lastReport !== null &&
      isPullRequestDeclaredUnnecessary(
        commentsBeforeOwnStatusComments,
        isTrustedAuthor,
      ) &&
      !this.reportBodyHasNextStep(lastReport.content)
    ) {
      const alreadyReturnedToWorkspace = comments.some(
        (comment) =>
          isTrustedAuthor(comment.author) &&
          comment.content.startsWith(
            RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD,
          ),
      );
      return {
        outcome: alreadyReturnedToWorkspace
          ? 'advanceToQualityCheck'
          : 'returnToLabelSelectedAgent',
        comments,
      };
    }

    const lastComment = comments[comments.length - 1];
    if (!lastComment || !lastComment.content.startsWith('From: :robot:')) {
      return { outcome: 'reject', comments };
    }
    if (this.reportBodyHasNextStep(lastComment.content)) {
      return { outcome: 'reject', comments };
    }

    const categoryLabels = issue.labels.filter((label) =>
      label.startsWith('category:'),
    );
    const isNonDeveloperAgent =
      issue.agent != null && issue.agent !== 'developer';
    const hasLabelNotRequiringPullRequest = issue.labels.some((label) =>
      labelsNotRequiringPullRequest.includes(label),
    );
    if (
      isNonDeveloperAgent ||
      hasLabelNotRequiringPullRequest ||
      (categoryLabels.length > 0 && !categoryLabels.includes('category:e2e'))
    ) {
      return { outcome: 'advanceToQualityCheck', comments };
    }

    const prsToCheck = issue.isPr
      ? await this.resolveOpenPrsForPrItem(issue.url)
      : await this.issueRepository.findRelatedOpenPRs(issue.url);

    if (prsToCheck.length !== 1) {
      return { outcome: 'reject', comments };
    }

    const pr = prsToCheck[0];
    const hasRejections =
      pr.isConflicted ||
      !pr.isPassedAllCiJob ||
      !pr.isResolvedAllReviewComments;
    return {
      outcome: hasRejections ? 'reject' : 'advanceToQualityCheck',
      comments,
    };
  };

  private resolveOpenPrsForPrItem = async (
    prUrl: string,
  ): Promise<RelatedPullRequest[]> => {
    const pr = await this.issueRepository.getOpenPullRequest(prUrl);
    if (pr === null) {
      return [];
    }
    return [pr];
  };

  private resolveNextStepAgent = (comments: Comment[]): string | null => {
    const lastReportComment = [...comments]
      .reverse()
      .find((comment) => comment.content.startsWith('From: :robot:'));
    return lastReportComment
      ? extractNextStepAgent(lastReportComment.content)
      : null;
  };

  private reportBodyHasNextStep = (body: string): boolean => {
    const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
    if (!reportMatch || reportMatch.length < 2) {
      return false;
    }
    let reportJson: unknown;
    try {
      reportJson = JSON.parse(reportMatch[1]);
    } catch (error) {
      console.warn(
        'Invalid JSON in report body while checking nextStep:',
        error,
      );
      return false;
    }
    if (typeof reportJson !== 'object' || reportJson === null) {
      return false;
    }
    if (!('nextStep' in reportJson)) {
      return false;
    }
    const nextStepValue = Reflect.get(reportJson, 'nextStep');
    return nextStepValue !== null && nextStepValue !== undefined;
  };

  private isOrphanedIssue = async (
    issue: Issue,
    params: {
      preparationProcessCheckCommand: string;
      awLogDirectoryPath?: string;
      awLogStaleThresholdMinutes?: number;
    },
  ): Promise<boolean> => {
    const commandTemplate = params.preparationProcessCheckCommand.replace(
      '{URL}',
      '$1',
    );
    const { exitCode } = await this.localCommandRunner.runCommand('sh', [
      '-c',
      commandTemplate,
      '--',
      issue.url,
    ]);

    if (exitCode !== 0) return true;

    const { awLogDirectoryPath, awLogStaleThresholdMinutes } = params;
    if (!awLogDirectoryPath || !awLogStaleThresholdMinutes) return false;

    return this.isAwLogStale(
      issue,
      awLogDirectoryPath,
      awLogStaleThresholdMinutes,
    );
  };

  private isAwLogStale = async (
    issue: Issue,
    awLogDirectoryPath: string,
    awLogStaleThresholdMinutes: number,
  ): Promise<boolean> => {
    const logPattern = `${issue.org}_${issue.repo}_${issue.number}_*`;

    const { stdout: anyFilesOutput, exitCode: anyFilesExitCode } =
      await this.localCommandRunner.runCommand('sh', [
        '-c',
        'find "$1" -name "$2"',
        '--',
        awLogDirectoryPath,
        logPattern,
      ]);

    if (anyFilesExitCode !== 0 || !anyFilesOutput.trim()) return false;

    const { stdout: recentFilesOutput, exitCode: recentFilesExitCode } =
      await this.localCommandRunner.runCommand('sh', [
        '-c',
        'find "$1" -name "$2" -mmin -$3',
        '--',
        awLogDirectoryPath,
        logPattern,
        String(awLogStaleThresholdMinutes),
      ]);

    if (recentFilesExitCode !== 0) return false;

    return !recentFilesOutput.trim();
  };
}
