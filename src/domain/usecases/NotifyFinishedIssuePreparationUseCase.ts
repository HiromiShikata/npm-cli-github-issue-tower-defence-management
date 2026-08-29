import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
import { ConsoleTabsRepository } from './adapter-interfaces/ConsoleTabsRepository';
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
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import { isTriagerAgentName } from './triagerAgentName';
import {
  ConsoleListItem,
  ConsoleTabName,
} from './console/GenerateConsoleListsUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';
import { extractNextStepAgent } from './extractNextStepAgent';
import { findLastAgentReport } from './findLastAgentReport';
import { isAgentReportBody } from './isAgentReportBody';
import {
  issueReactivationTriggerIsPending,
  issueReactivationTriggerStartOfTomorrow,
} from './issueReactivationTriggerIsPending';
import { normalizeReportBody } from './normalizeReportBody';
import {
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';

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
  'NO_REPORT_FROM_AGENT_BOT' | 'REPORT_HAS_NEXT_STEP' | PrRejectedReasonType;

export class NotifyFinishedIssuePreparationUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;
  private readonly changeTargetPullRequestApprover: ChangeTargetPullRequestApprover;

  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'getByUrl' | 'updateAgentList' | 'createField'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'get'
      | 'update'
      | 'updateStatus'
      | 'updateLabels'
      | 'getOrCreateLabel'
      | 'findRelatedOpenPRs'
      | 'getStoryObjectMap'
      | 'getOpenPullRequest'
      | 'getPullRequestChangedFilePaths'
      | 'approvePullRequest'
      | 'requestChangesWithInlineComment'
      | 'setDependedIssueUrl'
      | 'setIssueAgentField'
      | 'searchIssue'
      | 'createNewIssue'
      | 'updateNextActionDate'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
    private readonly webhookRepository: Pick<
      WebhookRepository,
      'sendGetRequest'
    >,
    private readonly consoleTabsRepository?: ConsoleTabsRepository | null,
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
    thresholdForDispatchLoop?: number;
    workflowBlockerResolvedWebhookUrl: string | null;
    allowedIssueAuthors?: string[] | null;
    labelsAsLlmAgentName?: string[] | null;
    labelsNotRequiringPullRequest?: string[] | null;
    changeTargetPathAliases?: Record<string, string> | null;
    agents?: string[] | null;
    missingAgentName?: string | null;
    sessionErrorLine?: string | null;
    manager?: string | null;
    developerAgentNames?: string[] | null;
    deferPreparation?: boolean | null;
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

    if (params.deferPreparation) {
      await this.handleTransientFailureDeferral(
        issue,
        project,
        awaitingWorkspaceStatusOption,
        params.sessionErrorLine ?? null,
      );
      return;
    }

    if (params.missingAgentName) {
      await this.handleMissingAgentDefinition(
        issue,
        project,
        awaitingWorkspaceStatusOption,
        params.missingAgentName,
        params.sessionErrorLine ?? null,
        params.manager ?? null,
      );
      return;
    }

    if (issue.dependedIssueUrls.length === 0) {
      try {
        const storyObjectMap =
          await this.issueRepository.getStoryObjectMap(project);
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
      await this.patchConsoleTab(issue);
      await this.issueCommentRepository.createComment(
        issue,
        `Issue has dependent issue URLs:\n${issue.dependedIssueUrls.map((url) => `- ${url}`).join('\n')}`,
      );
      return;
    }

    const evaluatedAt = new Date();
    if (issueReactivationTriggerIsPending(issue, evaluatedAt)) {
      issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.issueCommentRepository.createComment(
        issue,
        `Reactivation trigger not yet reached: nextActionDate=${issue.nextActionDate?.toISOString() ?? 'null'}, nextActionHour=${issue.nextActionHour ?? 'null'}`,
      );
      return;
    }

    const comments =
      await this.issueCommentRepository.getCommentsFromIssue(issue);

    const isTrustedAuthor = (author: string): boolean =>
      isAuthorAuthorizedForAutoStatusCheck(author, params.allowedIssueAuthors);

    const lastAgentReport = findLastAgentReport(comments, isTrustedAuthor);
    const nextStepAgent = lastAgentReport
      ? extractNextStepAgent(lastAgentReport.content)
      : null;
    if (
      nextStepAgent !== null &&
      params.agents &&
      params.agents.length > 0 &&
      !params.agents.includes(nextStepAgent)
    ) {
      issue.status = FAILED_PREPARATION_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        failedPreparationStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.issueCommentRepository.createComment(
        issue,
        `nextStepAgent '${nextStepAgent}' is not in the configured agents list. Update the configuration to include it.`,
      );
      return;
    }

    const ciFailingPrUrl = await this.resolveLinkedPrWithCiFailure(
      issue,
      params.developerAgentNames ?? null,
    );
    if (ciFailingPrUrl !== null) {
      const effectiveDeveloperAgentNames =
        params.developerAgentNames?.length
          ? params.developerAgentNames
          : ['developer'];
      const agentOptionId = await this.ensureAgentOptionAndGetId(
        project,
        effectiveDeveloperAgentNames[0],
      );
      if (agentOptionId !== null) {
        await this.issueRepository.setIssueAgentField(
          params.issueUrl,
          project,
          agentOptionId,
        );
      }
      issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.setDependedIssueUrlForAllOpenPRs(
        issue,
        params.issueUrl,
        project,
      );
      await this.issueCommentRepository.createComment(
        issue,
        `Auto Status Check: REJECTED\n- ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${ciFailingPrUrl}`,
      );
      return;
    }

    const { rejections, approvedPrUrl } = await this.collectRejections(
      issue,
      comments,
      isTrustedAuthor,
      resolveLabelsNotRequiringPullRequest(params),
      nextStepAgent,
      params.developerAgentNames,
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
      await this.patchConsoleTab(issue);
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

    if (nextStepAgent !== null) {
      const repetition = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: issue.agent,
        nextStepAgent,
        comments,
        isTrustedAuthor,
        thresholdForAutoReject: params.thresholdForAutoReject,
        thresholdForDispatchLoop:
          params.thresholdForDispatchLoop ??
          DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      });
      if (repetition.type === 'escalateToFailedPreparation') {
        issue.status = FAILED_PREPARATION_STATUS_NAME;
        await this.issueRepository.update(issue, project);
        await this.issueRepository.updateStatus(
          project,
          issue,
          failedPreparationStatusOption.id,
        );
        await this.patchConsoleTab(issue);
        await this.issueCommentRepository.createComment(
          issue,
          repetition.comment,
        );
        await this.sendWorkflowBlockerNotification(
          params.issueUrl,
          params.workflowBlockerResolvedWebhookUrl,
          project,
        );
        return;
      }
      const agentOptionId = await this.ensureAgentOptionAndGetId(
        project,
        nextStepAgent,
      );
      if (agentOptionId) {
        await this.issueRepository.setIssueAgentField(
          params.issueUrl,
          project,
          agentOptionId,
        );
      }
      issue.status = AWAITING_WORKSPACE_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      if (rejections.length > 0) {
        await this.setDependedIssueUrlForAllOpenPRs(
          issue,
          params.issueUrl,
          project,
        );
        await this.issueCommentRepository.createComment(
          issue,
          rejectionStatusMessage,
        );
      }
      if (repetition.type === 'dispatchAgain') {
        await this.issueCommentRepository.createComment(
          issue,
          repetition.comment,
        );
      }
      return;
    }

    if (rejections.length <= 0) {
      await this.changeTargetPullRequestApprover.approveIfConfined(
        issue.labels,
        approvedPrUrl,
        params.changeTargetPathAliases,
      );
      issue.status = AWAITING_QUALITY_CHECK_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingQualityCheckStatusOption.id,
      );
      await this.patchConsoleTab(issue);
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
    await this.patchConsoleTab(issue);

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

  private handleTransientFailureDeferral = async (
    issue: Issue,
    project: Project,
    awaitingWorkspaceStatusOption: { id: string },
    sessionErrorLine: string | null,
  ): Promise<void> => {
    const tomorrow = issueReactivationTriggerStartOfTomorrow(new Date());
    await this.issueRepository.updateNextActionDate(
      issue.url,
      project,
      tomorrow,
    );
    issue.status = AWAITING_WORKSPACE_STATUS_NAME;
    await this.issueRepository.update(issue, project);
    await this.issueRepository.updateStatus(
      project,
      issue,
      awaitingWorkspaceStatusOption.id,
    );
    await this.patchConsoleTab(issue);
    await this.issueCommentRepository.createComment(
      issue,
      `Preparation deferred due to transient failure; item reactivates from ${tomorrow.toISOString().split('T')[0]}\nSession stop reason: ${sessionErrorLine ?? '(not captured)'}`,
    );
  };

  private handleMissingAgentDefinition = async (
    issue: Issue,
    project: Project,
    awaitingWorkspaceStatusOption: { id: string },
    missingAgentName: string,
    sessionErrorLine: string | null,
    manager: string | null,
  ): Promise<void> => {
    const taskIssueTitle = `Register missing agent definition: ${missingAgentName}`;

    const searchResults = await this.issueRepository.searchIssue({
      owner: issue.org,
      repositoryName: issue.repo,
      type: 'issue',
      state: 'open',
      title: taskIssueTitle,
    });
    const exactMatch = searchResults.find((i) => i.title === taskIssueTitle);

    let taskIssueUrl: string;
    if (exactMatch) {
      taskIssueUrl = exactMatch.url;
    } else {
      const body = [
        `The preparation worker for ${issue.url} failed because the agent definition \`${missingAgentName}\` was not found.`,
        '',
        `- Missing agent name: \`${missingAgentName}\``,
        `- Failing item: ${issue.url}`,
        `- Error: ${sessionErrorLine ?? '(not captured)'}`,
      ].join('\n');
      if (!manager) {
        throw new Error(
          `'manager' is not configured: cannot create the missing-agent task issue for '${missingAgentName}' without an assignee. Set the 'manager' configuration key to a GitHub username.`,
        );
      }
      const issueNumber = await this.issueRepository.createNewIssue(
        issue.org,
        issue.repo,
        taskIssueTitle,
        body,
        [manager],
        [],
      );
      taskIssueUrl = `https://github.com/${issue.org}/${issue.repo}/issues/${issueNumber}`;
    }

    if (project.dependedIssueUrlSeparatedByComma) {
      await this.issueRepository.setDependedIssueUrl(
        issue.url,
        project,
        taskIssueUrl,
      );
    } else {
      console.warn(
        `dependedIssueUrlSeparatedByComma not configured; cannot block ${issue.url} via ${taskIssueUrl}`,
      );
    }

    issue.status = AWAITING_WORKSPACE_STATUS_NAME;
    await this.issueRepository.update(issue, project);
    await this.issueRepository.updateStatus(
      project,
      issue,
      awaitingWorkspaceStatusOption.id,
    );
    await this.patchConsoleTab(issue);
    await this.issueCommentRepository.createComment(
      issue,
      `Session ended: agent definition \`${missingAgentName}\` was not found.\nItem blocked until the following task issue is resolved:\n${taskIssueUrl}`,
    );
  };

  private collectRejections = async (
    issue: {
      url: string;
      labels: string[];
      isPr: boolean;
      body?: string | null;
    },
    comments: { author: string; content: string }[],
    isTrustedAuthor: (author: string) => boolean,
    labelsNotRequiringPullRequest: string[],
    nextStepAgent: string | null,
    developerAgentNames?: string[] | null,
  ): Promise<{
    rejections: { type: RejectedReasonType; detail: string }[];
    approvedPrUrl: string | null;
  }> => {
    const rejections: { type: RejectedReasonType; detail: string }[] = [];

    const lastComment = comments[comments.length - 1];
    if (
      !lastComment ||
      !isTrustedAuthor(lastComment.author) ||
      !isAgentReportBody(lastComment.content)
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
      await this.issueRejectionEvaluator.evaluate(
        issue,
        labelsNotRequiringPullRequest,
        { developerAgentNames },
      );
    const requiredPrRejections = isTriagerAgentName(nextStepAgent)
      ? prRejections.filter(
          (rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND',
        )
      : prRejections;
    return {
      rejections: [...rejections, ...requiredPrRejections],
      approvedPrUrl,
    };
  };

  private reportBodyHasNextStep = (body: string): boolean => {
    const reportMatch = normalizeReportBody(body).match(
      /```json\n([\s\S]*?)\n```/,
    );
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
      if (pr.url === issueUrl) {
        continue;
      }
      await this.issueRepository.setDependedIssueUrl(pr.url, project, issueUrl);
    }
  };

  private resolveLinkedPrWithCiFailure = async (
    issue: { url: string; agent: string | null; isPr: boolean },
    developerAgentNames: string[] | null,
  ): Promise<string | null> => {
    const effectiveDeveloperAgentNames =
      developerAgentNames?.length ? developerAgentNames : ['developer'];
    if (
      issue.agent === null ||
      effectiveDeveloperAgentNames.includes(issue.agent) ||
      issue.agent === 'pr-reviewer'
    ) {
      return null;
    }
    let openPrs: { url: string; isPassedAllCiJob: boolean }[];
    if (issue.isPr) {
      const pr = await this.issueRepository.getOpenPullRequest(issue.url);
      openPrs = pr === null ? [] : [pr];
    } else {
      openPrs = await this.issueRepository.findRelatedOpenPRs(issue.url);
    }
    if (openPrs.length !== 1) {
      return null;
    }
    const pr = openPrs[0];
    return !pr.isPassedAllCiJob ? pr.url : null;
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
      const storyObjectMap =
        await this.issueRepository.getStoryObjectMap(project);

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

  private resolveConsoleTargetTab = (status: string): ConsoleTabName | null => {
    const lower = status.toLowerCase();
    if (lower === AWAITING_QUALITY_CHECK_STATUS_NAME.toLowerCase())
      return 'prs';
    if (lower === FAILED_PREPARATION_STATUS_NAME.toLowerCase())
      return 'failed-preparation';
    return null;
  };

  private ensureAgentOptionAndGetId = async (
    project: Project,
    agentName: string,
  ): Promise<string | null> =>
    ensureAgentOptionAndGetId(this.projectRepository, project, agentName);

  private patchConsoleTab = async (issue: Issue): Promise<void> => {
    if (!this.consoleTabsRepository) return;
    const targetTabName = this.resolveConsoleTargetTab(issue.status ?? '');
    const relatedOpenPullRequestUrls: string[] =
      !issue.isPr && targetTabName !== null
        ? (await this.issueRepository.findRelatedOpenPRs(issue.url)).map(
            (pr) => pr.url,
          )
        : [];
    const item: ConsoleListItem = {
      number: issue.number,
      title: issue.title,
      url: issue.url,
      repo: issue.nameWithOwner,
      nameWithOwner: issue.nameWithOwner,
      projectItemId: issue.itemId,
      itemId: issue.itemId,
      isPr: issue.isPr,
      story: issue.story ?? '',
      status: issue.status,
      agent: issue.agent,
      nextActionDate:
        issue.nextActionDate === null
          ? null
          : issue.nextActionDate.toISOString(),
      nextActionHour: issue.nextActionHour,
      dependedIssueUrls: issue.dependedIssueUrls,
      labels: issue.labels,
      createdAt: issue.createdAt.toISOString(),
      relatedOpenPullRequestUrls,
    };
    this.consoleTabsRepository.patchIssueTabTransition({
      projectItemId: issue.itemId,
      item,
      targetTabName,
    });
  };
}
