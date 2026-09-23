import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
import { ConsoleTabsRepository } from './adapter-interfaces/ConsoleTabsRepository';
import {
  AWAITING_OWNER_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
  DISABLED_STATUS_NAME,
  DONE_STATUS_NAME,
  FAILED_PREPARATION_STATUS_NAME,
  ICEBOX_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
  PREPARATION_STATUS_NAME,
  TODO_STATUS_NAME,
} from '../entities/WorkflowStatus';
import {
  IssueRejectionEvaluator,
  PrRejectedReasonType,
} from './IssueRejectionEvaluator';
import { ChangeTargetPullRequestApprover } from './ChangeTargetPullRequestApprover';
import { resolveLabelsNotRequiringPullRequest } from './resolveLabelsNotRequiringPullRequest';
import {
  ConsoleListItem,
  ConsoleTabName,
} from './console/GenerateConsoleListsUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';
import { extractNeedOwnerConfirmationOrApproval } from './extractNeedOwnerConfirmationOrApproval';
import { extractNextStepAgent } from './extractNextStepAgent';
import { extractStory } from './extractStory';
import { extractWorkflowError } from './extractWorkflowError';
import { findLastAgentReport } from './findLastAgentReport';

import {
  extractAgentNameFromReportBody,
  isAgentReportBody,
  isAgentReportBodyFromAgent,
} from './isAgentReportBody';
import { REACTIVATION_TRIGGER_COMMENT_HEAD } from './dependencyNotificationCommentHeads';
import {
  issueReactivationTriggerIsPending,
  issueReactivationTriggerStartOfTomorrow,
} from './issueReactivationTriggerIsPending';
import {
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';
import { NO_STORY_STORY_NAME } from '../entities/RequiredProjectField';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import {
  reportSilentRedispatchWorkflowIssue,
  WorkflowIssueReporterSettings,
} from './reportSilentRedispatchWorkflowIssue';
import { isDuplicateWithinWindow } from '../services/commentDeduplication';

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
export class RepositoryArchivedError extends Error {
  constructor(org: string, repo: string) {
    super(`Repository ${org}/${repo} is archived and cannot be written to`);
    this.name = 'RepositoryArchivedError';
  }
}
type RejectedReasonType = 'NO_REPORT_FROM_AGENT_BOT' | PrRejectedReasonType;
type NotifyFinishedIssuePreparationParams = {
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
  defaultAgentName?: string | null;
  deferPreparation?: boolean | null;
  moveToFailedPreparation?: boolean | null;
  workflowIssueReporterSettings?: WorkflowIssueReporterSettings | null;
  tdpmReportingRepository?: string | null;
  projectName?: string | null;
};

const parseOrgRepo = (
  repository: string | null,
): { owner: string; repo: string } | null => {
  if (!repository) {
    return null;
  }
  const slashIndex = repository.indexOf('/');
  if (slashIndex <= 0 || slashIndex === repository.length - 1) {
    return null;
  }
  if (repository.indexOf('/', slashIndex + 1) !== -1) {
    return null;
  }
  return {
    owner: repository.slice(0, slashIndex),
    repo: repository.slice(slashIndex + 1),
  };
};

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
      | 'createCommentByUrl'
      | 'getIssueOrPullRequestComments'
      | 'updateNextActionDate'
      | 'updateStory'
      | 'addIssueToProject'
      | 'getIssueByUrl'
      | 'updateStoryByProjectItemId'
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

  run = async (params: NotifyFinishedIssuePreparationParams): Promise<void> => {
    try {
      await this.runInternal(params);
    } catch (e) {
      if (e instanceof RepositoryArchivedError) {
        console.warn(`notifyFinishedIssuePreparation skipped: ${e.message}`);
        return;
      }
      throw e;
    }
  };

  private runInternal = async (
    params: NotifyFinishedIssuePreparationParams,
  ): Promise<void> => {
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
    const awaitingOwnerStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_OWNER_STATUS_NAME,
    );
    if (!awaitingOwnerStatusOption) {
      console.error(
        `Awaiting owner status option '${AWAITING_OWNER_STATUS_NAME}' not found in project.`,
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
      console.warn(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} not found on project ${params.projectUrl}`,
      );
      return;
    }

    if (params.moveToFailedPreparation) {
      await this.handleConsecutiveFailureMaxReached(
        issue,
        project,
        failedPreparationStatusOption,
        params.sessionErrorLine ?? null,
      );
      return;
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

    if (issue.status === DONE_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is already Done`,
      );
      return;
    } else if (issue.status === AWAITING_WORKSPACE_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is already Awaiting Workspace`,
      );
      return;
    } else if (issue.status === TODO_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is in Todo by human`,
      );
      return;
    } else if (issue.status === ICEBOX_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is in Icebox`,
      );
      return;
    } else if (issue.status === AWAITING_OWNER_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is already Awaiting Owner`,
      );
      return;
    } else if (issue.status === DISABLED_STATUS_NAME) {
      console.log(
        `notifyFinishedIssuePreparation skipped: issue ${params.issueUrl} is Disabled`,
      );
      return;
    } else if (
      issue.status !== PREPARATION_STATUS_NAME &&
      issue.status !== IN_TMUX_BY_AGENT_STATUS_NAME
    ) {
      throw new IllegalIssueStatusError(
        params.issueUrl,
        issue.status,
        `${PREPARATION_STATUS_NAME} or ${IN_TMUX_BY_AGENT_STATUS_NAME}`,
      );
    }

    const reportingTarget = parseOrgRepo(
      params.tdpmReportingRepository ?? null,
    );
    if (params.tdpmReportingRepository && !reportingTarget) {
      console.warn(
        `tdpmReportingRepository "${params.tdpmReportingRepository}" is not a valid "owner/repo" string; falling back to product repository`,
      );
    }

    if (params.missingAgentName) {
      await this.handleMissingAgentDefinition(
        issue,
        project,
        awaitingWorkspaceStatusOption,
        params.missingAgentName,
        params.sessionErrorLine ?? null,
        params.manager ?? null,
        reportingTarget,
        params.projectName ?? null,
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
      console.log(this.formatReactivationTriggerMessage(issue));
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
      await this.createCommentWithDedup(
        issue,
        this.formatReactivationTriggerMessage(issue),
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
    let storyName = lastAgentReport
      ? extractStory(lastAgentReport.content)
      : null;
    const reporterName =
      lastAgentReport !== null
        ? extractAgentNameFromReportBody(lastAgentReport.content)
        : null;
    if (
      issue.agent === null ||
      lastAgentReport === null ||
      reporterName === null ||
      !isAgentReportBodyFromAgent(
        lastAgentReport.content,
        reporterName,
        issue.agent,
      )
    ) {
      storyName = null;
    }
    if (
      nextStepAgent !== null &&
      params.agents &&
      params.agents.length > 0 &&
      !params.agents.includes(nextStepAgent)
    ) {
      await this.handleUnregisteredNextStepAgent(
        issue,
        project,
        awaitingWorkspaceStatusOption,
        nextStepAgent,
        reportingTarget,
        params.projectName ?? null,
      );
      return;
    }

    const ciFailingPrUrl = await this.resolveLinkedPrWithCiFailure(
      issue,
      params.developerAgentNames ?? null,
    );
    if (ciFailingPrUrl !== null) {
      const firstDeveloperAgentName =
        params.developerAgentNames?.length != null &&
        params.developerAgentNames.length > 0
          ? params.developerAgentNames[0]
          : null;
      const agentOptionId =
        firstDeveloperAgentName !== null
          ? await this.ensureAgentOptionAndGetId(
              project,
              firstDeveloperAgentName,
            )
          : null;
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
      await this.createCommentWithDedup(
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
      params.defaultAgentName,
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
      await this.createCommentWithDedup(
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

    const isNoStory =
      nextStepAgent !== null &&
      (issue.story === null || issue.story.startsWith(NO_STORY_STORY_NAME));
    const repetition = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: issue.agent,
      nextStepAgent,
      comments,
      isTrustedAuthor,
      thresholdForAutoReject: params.thresholdForAutoReject,
      thresholdForDispatchLoop:
        params.thresholdForDispatchLoop ?? DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      isNoStory,
    });
    if (repetition.type === 'escalateSilentRedispatch') {
      issue.status = FAILED_PREPARATION_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        failedPreparationStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.createCommentWithDedup(issue, repetition.comment);
      await this.sendWorkflowBlockerNotification(
        params.issueUrl,
        params.workflowBlockerResolvedWebhookUrl,
        project,
      );
      if (nextStepAgent !== null && params.workflowIssueReporterSettings) {
        await reportSilentRedispatchWorkflowIssue(
          nextStepAgent,
          params.issueUrl,
          params.workflowIssueReporterSettings,
          this.issueRepository,
          this.projectRepository,
        );
      }
      return;
    }
    if (
      repetition.type === 'escalateReportingLoop' ||
      (repetition.type === 'escalateDispatchLoop' && nextStepAgent !== null)
    ) {
      issue.status = FAILED_PREPARATION_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        failedPreparationStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.createCommentWithDedup(issue, repetition.comment);
      return;
    }
    if (repetition.type === 'escalateDispatchLoop' && nextStepAgent === null) {
      issue.status = FAILED_PREPARATION_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        failedPreparationStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      await this.createCommentWithDedup(issue, repetition.comment);
      await this.sendWorkflowBlockerNotification(
        params.issueUrl,
        params.workflowBlockerResolvedWebhookUrl,
        project,
      );
      return;
    }

    if (nextStepAgent !== null) {
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
      if (storyName !== null && project.story !== null) {
        const storyOptionId = project.story.stories.find(
          (s) => s.name === storyName,
        )?.id;
        if (storyOptionId !== undefined) {
          await this.issueRepository.updateStory(
            { ...project, story: project.story },
            issue,
            storyOptionId,
          );
        }
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
        await this.createCommentWithDedup(issue, rejectionStatusMessage);
      }
      if (
        repetition.type === 'dispatchAgain' ||
        repetition.type === 'storyUnset'
      ) {
        await this.createCommentWithDedup(issue, repetition.comment);
      }
      return;
    }

    const workflowError = lastAgentReport
      ? extractWorkflowError(lastAgentReport.content)
      : null;
    if (workflowError !== null) {
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
      await this.createCommentWithDedup(
        issue,
        `Workflow error: ${workflowError}`,
      );
      await this.sendWorkflowBlockerNotification(
        params.issueUrl,
        params.workflowBlockerResolvedWebhookUrl,
        project,
      );
      return;
    }

    const needOwnerConfirmationOrApproval = lastAgentReport
      ? extractNeedOwnerConfirmationOrApproval(lastAgentReport.content)
      : false;
    if (needOwnerConfirmationOrApproval) {
      issue.status = AWAITING_OWNER_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingOwnerStatusOption.id,
      );
      await this.patchConsoleTab(issue);
      return;
    }

    if (rejections.length <= 0) {
      await this.changeTargetPullRequestApprover.approveIfConfined(
        issue.labels,
        approvedPrUrl,
        params.changeTargetPathAliases,
      );
      issue.status = AWAITING_OWNER_STATUS_NAME;
      await this.issueRepository.update(issue, project);
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingOwnerStatusOption.id,
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

    await this.createCommentWithDedup(issue, rejectionStatusMessage);
  };

  private handleConsecutiveFailureMaxReached = async (
    issue: Issue,
    project: Project,
    failedPreparationStatusOption: { id: string },
    sessionErrorLine: string | null,
  ): Promise<void> => {
    issue.status = FAILED_PREPARATION_STATUS_NAME;
    await this.issueRepository.update(issue, project);
    await this.issueRepository.updateStatus(
      project,
      issue,
      failedPreparationStatusOption.id,
    );
    await this.patchConsoleTab(issue);
    await this.createCommentWithDedup(
      issue,
      `Preparation moved to Failed Preparation after reaching the consecutive failure threshold.\nSession stop reason: ${sessionErrorLine ?? '(not captured)'}`,
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
    console.log(
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
    reportingTarget: { owner: string; repo: string } | null,
    projectName: string | null,
  ): Promise<void> => {
    const taskIssueTitle = `Register missing agent definition: ${missingAgentName}`;
    const targetOwner = reportingTarget?.owner ?? issue.org;
    const targetRepo = reportingTarget?.repo ?? issue.repo;

    const searchResults = await this.issueRepository.searchIssue({
      owner: targetOwner,
      repositoryName: targetRepo,
      type: 'issue',
      state: 'open',
      title: taskIssueTitle,
    });
    const exactMatch = searchResults.find((i) => i.title === taskIssueTitle);

    let taskIssueUrl: string;
    if (exactMatch) {
      taskIssueUrl = exactMatch.url;
    } else {
      const bodyLines = [
        `The preparation worker for ${issue.url} failed because the agent definition \`${missingAgentName}\` was not found.`,
        '',
        `- Missing agent name: \`${missingAgentName}\``,
        `- Failing item: ${issue.url}`,
        `- Error: ${sessionErrorLine ?? '(not captured)'}`,
      ];
      if (projectName !== null) {
        bodyLines.push(`- TDPM project: ${projectName}`);
      }
      const body = bodyLines.join('\n');
      if (!manager) {
        throw new Error(
          `'manager' is not configured: cannot create the missing-agent task issue for '${missingAgentName}' without an assignee. Set the 'manager' configuration key to a GitHub username.`,
        );
      }
      const issueNumber = await this.issueRepository.createNewIssue(
        targetOwner,
        targetRepo,
        taskIssueTitle,
        body,
        [manager],
        [],
      );
      taskIssueUrl = `https://github.com/${targetOwner}/${targetRepo}/issues/${issueNumber}`;
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
    await this.createCommentWithDedup(
      issue,
      `Session ended: agent definition \`${missingAgentName}\` was not found.\nItem blocked until the following task issue is resolved:\n${taskIssueUrl}`,
    );
  };

  private handleUnregisteredNextStepAgent = async (
    issue: Issue,
    project: Project,
    awaitingWorkspaceStatusOption: { id: string },
    nextStepAgent: string,
    reportingTarget: { owner: string; repo: string } | null,
    projectName: string | null,
  ): Promise<void> => {
    const blockerIssueTitle = `Unregistered agent in workflow configuration: ${nextStepAgent}`;
    const targetOwner = reportingTarget?.owner ?? issue.org;
    const targetRepo = reportingTarget?.repo ?? issue.repo;

    const searchResults = await this.issueRepository.searchIssue({
      owner: targetOwner,
      repositoryName: targetRepo,
      type: 'issue',
      state: 'open',
      title: blockerIssueTitle,
    });
    const exactMatch = searchResults.find((i) => i.title === blockerIssueTitle);

    let blockerIssueUrl: string;
    if (exactMatch) {
      blockerIssueUrl = exactMatch.url;
    } else {
      const bodyLines = [
        `The last agent report on ${issue.url} designated \`nextStepAgent\` as \`${nextStepAgent}\`, which is absent from the configured agents list.`,
        '',
        `- Missing agent name: \`${nextStepAgent}\``,
        `- Declaring task: ${issue.url}`,
      ];
      if (projectName !== null) {
        bodyLines.push(`- TDPM project: ${projectName}`);
      }
      const body = bodyLines.join('\n');
      const issueNumber = await this.issueRepository.createNewIssue(
        targetOwner,
        targetRepo,
        blockerIssueTitle,
        body,
        [],
        [],
      );
      blockerIssueUrl = `https://github.com/${targetOwner}/${targetRepo}/issues/${issueNumber}`;
    }

    if (project.story) {
      const workflowBlockerStory = project.story.stories.find((s) =>
        s.name.toLowerCase().includes('workflow blocker'),
      );
      if (workflowBlockerStory) {
        const projectItemId = await this.issueRepository.addIssueToProject(
          project,
          blockerIssueUrl,
        );
        await this.issueRepository.updateStoryByProjectItemId(
          { ...project, story: project.story },
          projectItemId,
          workflowBlockerStory.id,
        );
      }
    }

    if (project.dependedIssueUrlSeparatedByComma) {
      await this.issueRepository.setDependedIssueUrl(
        issue.url,
        project,
        blockerIssueUrl,
      );
    } else {
      console.warn(
        `dependedIssueUrlSeparatedByComma not configured; cannot block ${issue.url} via ${blockerIssueUrl}`,
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
    await this.createCommentWithDedup(
      issue,
      `nextStepAgent \`${nextStepAgent}\` is not in the configured agents list. Created workflow blocker task:\n${blockerIssueUrl}`,
    );
  };

  private collectRejections = async (
    issue: {
      url: string;
      labels: string[];
      isPr: boolean;
      body?: string | null;
      agent: string | null;
    },
    comments: { author: string; content: string }[],
    isTrustedAuthor: (author: string) => boolean,
    labelsNotRequiringPullRequest: string[],
    nextStepAgent: string | null,
    developerAgentNames?: string[] | null,
    defaultAgentName?: string | null,
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
    }

    const { rejections: prRejections, approvedPrUrl } =
      await this.issueRejectionEvaluator.evaluate(
        issue,
        labelsNotRequiringPullRequest,
        { developerAgentNames },
      );
    const lastAgentReport = findLastAgentReport(comments, isTrustedAuthor);
    const effectiveDeveloperAgentNames = developerAgentNames ?? [];
    const lastReportIsFromDeveloperAgent =
      lastAgentReport !== null &&
      effectiveDeveloperAgentNames.some((name) =>
        isAgentReportBodyFromAgent(lastAgentReport.content, name, issue.agent),
      );
    const nextStepIsDefaultAgent =
      defaultAgentName != null && nextStepAgent === defaultAgentName;
    const requiredPrRejections =
      nextStepIsDefaultAgent || !lastReportIsFromDeveloperAgent
        ? prRejections.filter(
            (rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND',
          )
        : prRejections;
    return {
      rejections: [...rejections, ...requiredPrRejections],
      approvedPrUrl,
    };
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
    const effectiveDeveloperAgentNames = developerAgentNames ?? [];
    if (
      issue.agent === null ||
      effectiveDeveloperAgentNames.length === 0 ||
      effectiveDeveloperAgentNames.includes(issue.agent)
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
    if (lower === AWAITING_OWNER_STATUS_NAME.toLowerCase()) return 'prs';
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

  private formatReactivationTriggerMessage = (issue: {
    dependedIssueUrls: string[];
    nextActionDate: Date | null;
    nextActionHour: number | null;
  }): string => {
    const dependedIssueUrlValue =
      issue.dependedIssueUrls.length > 0
        ? issue.dependedIssueUrls.join(', ')
        : 'not set';
    const nextActionDateValue =
      issue.nextActionDate !== null
        ? issue.nextActionDate.toISOString().slice(0, 10)
        : 'not set';
    const nextActionHourValue =
      issue.nextActionHour !== null ? String(issue.nextActionHour) : 'not set';
    return `${REACTIVATION_TRIGGER_COMMENT_HEAD}\n- Depended Issue URL: ${dependedIssueUrlValue}\n- Next Action Date: ${nextActionDateValue}\n- Next Action Hour: ${nextActionHourValue}`;
  };

  private createCommentWithDedup = async (
    issue: Issue,
    body: string,
  ): Promise<void> => {
    const existing =
      await this.issueCommentRepository.getCommentsFromIssue(issue);
    if (
      isDuplicateWithinWindow(
        body,
        existing.map((c) => ({ text: c.content, createdAt: c.createdAt })),
        new Date(),
      )
    ) {
      return;
    }
    await this.issueCommentRepository.createComment(issue, body);
  };
}
