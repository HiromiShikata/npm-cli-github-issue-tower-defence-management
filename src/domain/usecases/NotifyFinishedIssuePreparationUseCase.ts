import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  PREPARATION_STATUS_NAME,
} from '../entities/WorkflowStatus';
import {
  IssueRejectionEvaluator,
  PrRejectedReasonType,
} from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';

export class IssueNotFoundError extends Error {
  constructor(issueUrl: string) {
    super(`Issue not found: ${issueUrl}`);
    this.name = 'IssueNotFoundError';
  }
}
export class IllegalIssueStatusError extends Error {
  constructor(
    issueUrl: string,
    currentStatus: string | null,
    expectedStatus: string | null,
  ) {
    super(
      `Illegal issue status for ${issueUrl}: expected ${expectedStatus}, but got ${currentStatus}`,
    );
    this.name = 'IllegalIssueStatusError';
  }
}
type RejectedReasonType =
  | 'NO_REPORT_FROM_AGENT_BOT'
  | 'REPORT_HAS_NEXT_STEP'
  | PrRejectedReasonType;

export class NotifyFinishedIssuePreparationUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;
  private readonly changeTargetPullRequestApprover: ChangeTargetPullRequestApprover;

  constructor(
    private readonly projectRepository: Pick<ProjectRepository, 'getByUrl'>,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'get'
      | 'update'
      | 'updateStatus'
      | 'findRelatedOpenPRs'
      | 'getStoryObjectMap'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'approvePullRequest'
      | 'requestChangesWithInlineComment'
      | 'createCommentByUrl'
      | 'setDependedIssueUrl'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    private readonly webhookRepository: Pick<
      WebhookRepository,
      'sendGetRequest'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
    this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover(
      issueRepository,
    );
  }

  run = async (params: {
    projectUrl: string;
    issueUrl: string;
    thresholdForAutoReject: number;
    workflowBlockerResolvedWebhookUrl: string | null;
    allowedIssueAuthors?: string[] | null;
    labelsAsLlmAgentName?: string[] | null;
  }): Promise<void> => {
    const project = await this.projectRepository.getByUrl(params.projectUrl);

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      console.error(
        `Awaiting workspace status option '${AWAITING_WORKSPACE_STATUS_NAME}' not found in project.`,
      );
      return;
    }
    const awaitingQualityCheckStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_QUALITY_CHECK_STATUS_NAME,
    );
    if (!awaitingQualityCheckStatusOption) {
      console.error(
        `Awaiting quality check status option '${AWAITING_QUALITY_CHECK_STATUS_NAME}' not found in project.`,
      );
      return;
    }
    const failedPreparationStatusOption = project.status.statuses.find(
      (s) => s.name === FAILED_PREPARATION_STATUS_NAME,
    );
    if (!failedPreparationStatusOption) {
      console.error(
        `Failed preparation status option '${FAILED_PREPARATION_STATUS_NAME}' not found in project.`,
      );
      return;
    }

    const issue = await this.issueRepository.get(params.issueUrl, project);

    if (!issue) {
      throw new IssueNotFoundError(params.issueUrl);
    } else if (issue.status !== PREPARATION_STATUS_NAME) {
      throw new IllegalIssueStatusError(
        params.issueUrl,
        issue.status,
        PREPARATION_STATUS_NAME,
      );
    }

    if (issue.dependedIssueUrls.length === 0) {
      try {
        const storyObjectMap = await this.issueRepository.getStoryObjectMap(
          project,
          0,
        );
        for (const storyObject of storyObjectMap.values()) {
          const towerDefenceIssue = storyObject.issues.find(
            (i) => i.url === issue.url,
          );
          if (towerDefenceIssue) {
            issue.dependedIssueUrls = towerDefenceIssue.dependedIssueUrls;
            break;
          }
        }
      } catch (error) {
        console.warn(
          'Failed to enrich dependedIssueUrls from story object map:',
          error,
        );
      }
    }

    if (issue.dependedIssueUrls.length > 0) {
      issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.issueCommentRepository.createComment(
        issue,
        `Issue has dependent issue URLs: ${issue.dependedIssueUrls.join(', ')}`,
      );
      return;
    }

    if (issue.nextActionDate !== null || issue.nextActionHour !== null) {
      issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.issueCommentRepository.createComment(
        issue,
        `Issue has next action date or hour set: nextActionDate=${issue.nextActionDate?.toISOString() ?? 'null'}, nextActionHour=${issue.nextActionHour ?? 'null'}`,
      );
      return;
    }

    const comments =
      await this.issueCommentRepository.getCommentsFromIssue(issue);

    const isTrustedAuthor = (author: string): boolean =>
      this.isAuthorTrusted(author, params.allowedIssueAuthors ?? null);

    const { rejections, approvedPrUrl } = await this.collectRejections(
      issue,
      comments,
      isTrustedAuthor,
      params.labelsAsLlmAgentName ?? [],
    );

    const rejectionStatusMessage =
      rejections.length > 0
        ? `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`
        : 'Auto Status Check: APPROVED';

    const lastTargetComments = comments.slice(
      -params.thresholdForAutoReject * 2,
    );
    if (
      rejections.length > 0 &&
      lastTargetComments.filter(
        (comment) =>
          comment.content.startsWith('Auto Status Check: REJECTED') &&
          isTrustedAuthor(comment.author),
      ).length >= params.thresholdForAutoReject &&
      !lastTargetComments.some(
        (comment) =>
          comment.content
            .toLowerCase()
            .includes('failed to pass the check automatically') &&
          isTrustedAuthor(comment.author),
      )
    ) {
      issue.status = FAILED_PREPARATION_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        failedPreparationStatusOption.id,
      );
      await this.setDependedIssueUrlForAllOpenPRs(
        issue,
        params.issueUrl,
        project,
      );
      await this.issueCommentRepository.createComment(
        issue,
        `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`,
      );
      await this.sendWorkflowBlockerNotification(
        params.issueUrl,
        params.workflowBlockerResolvedWebhookUrl,
        project,
      );
      return;
    }

    if (rejections.length <= 0) {
      await this.changeTargetPullRequestApprover.approveIfConfined(
        issue.labels,
        approvedPrUrl,
      );
      issue.status = AWAITING_QUALITY_CHECK_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingQualityCheckStatusOption.id,
      );
      await this.setDependedIssueUrlForAllOpenPRs(
        issue,
        params.issueUrl,
        project,
      );
      await this.sendWorkflowBlockerNotification(
        params.issueUrl,
        params.workflowBlockerResolvedWebhookUrl,
        project,
      );
      return;
    }

    issue.status = AWAITING_WORKSPACE_STATUS_NAME;
    await this.issueRepository.update(issue, project);
    await this.issueRepository.updateStatus(
      project,
      issue,
      awaitingWorkspaceStatusOption.id,
    );

    await this.setDependedIssueUrlForAllOpenPRs(
      issue,
      params.issueUrl,
      project,
    );

    await this.issueCommentRepository.createComment(
      issue,
      rejectionStatusMessage,
    );
  };

  private isAuthorTrusted = (
    author: string,
    allowedIssueAuthors: string[] | null,
  ): boolean =>
    allowedIssueAuthors === null || allowedIssueAuthors.includes(author);

  private collectRejections = async (
    issue: { url: string; labels: string[]; isPr: boolean },
    comments: { author: string; content: string }[],
    isTrustedAuthor: (author: string) => boolean,
    labelsAsLlmAgentName: string[],
  ): Promise<{
    rejections: { type: RejectedReasonType; detail: string }[];
    approvedPrUrl: string | null;
  }> => {
    const rejections: { type: RejectedReasonType; detail: string }[] = [];

    const lastComment = comments[comments.length - 1];
    if (
      !lastComment ||
      !isTrustedAuthor(lastComment.author) ||
      !lastComment.content.startsWith('From: :robot:')
    ) {
      rejections.push({
        type: 'NO_REPORT_FROM_AGENT_BOT',
        detail: 'NO_REPORT_FROM_AGENT_BOT',
      });
    } else if (this.reportBodyHasNextStep(lastComment.content)) {
      rejections.push({
        type: 'REPORT_HAS_NEXT_STEP',
        detail: 'REPORT_HAS_NEXT_STEP',
      });
    }

    const { rejections: prRejections, approvedPrUrl } =
      await this.issueRejectionEvaluator.evaluate(issue, labelsAsLlmAgentName);
    return { rejections: [...rejections, ...prRejections], approvedPrUrl };
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

  private setDependedIssueUrlForAllOpenPRs = async (
    issue: { url: string; labels: string[]; isPr: boolean },
    issueUrl: string,
    project: Parameters<IssueRepository['get']>[1],
  ): Promise<void> => {
    if (!project.dependedIssueUrlSeparatedByComma) {
      console.warn(
        `dependedIssueUrlSeparatedByComma field not configured in project, skipping depended issue URL update for issue ${issueUrl}`,
      );
      return;
    }
    const openPRs = issue.isPr
      ? await this.resolveOpenPrsForPrItem(issue.url)
      : await this.issueRepository.findRelatedOpenPRs(issue.url);
    for (const pr of openPRs) {
      await this.issueRepository.setDependedIssueUrl(pr.url, project, issueUrl);
    }
  };

  private resolveOpenPrsForPrItem = async (
    prUrl: string,
  ): Promise<{ url: string }[]> => {
    const pr = await this.issueRepository.getOpenPullRequest(prUrl);
    if (pr === null) {
      return [];
    }
    return [pr];
  };

  private sendWorkflowBlockerNotification = async (
    issueUrl: string,
    webhookUrlTemplate: string | null,
    project: Parameters<IssueRepository['getStoryObjectMap']>[0],
  ): Promise<void> => {
    if (webhookUrlTemplate === null) {
      return;
    }

    try {
      const storyObjectMap = await this.issueRepository.getStoryObjectMap(
        project,
        0,
      );

      const isWorkflowBlocker = Array.from(storyObjectMap.entries()).some(
        ([storyName, storyObject]) =>
          storyName.toLowerCase().includes('workflow blocker') &&
          storyObject.issues.some((issue) => issue.url === issueUrl),
      );

      if (!isWorkflowBlocker) {
        return;
      }

      const message = `Workflow blocker resolved: ${issueUrl}`;
      const webhookUrl = webhookUrlTemplate
        .replace('{URL}', encodeURIComponent(issueUrl))
        .replace('{MESSAGE}', encodeURIComponent(message));

      await this.webhookRepository.sendGetRequest(webhookUrl);
    } catch (error) {
      console.warn('Failed to send workflow blocker notification:', error);
    }
  };
}
