"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyFinishedIssuePreparationUseCase = exports.IllegalIssueStatusError = exports.IssueNotFoundError = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const ChangeTargetPullRequestApprover_1 = require("./ChangeTargetPullRequestApprover");
const resolveLabelsNotRequiringPullRequest_1 = require("./resolveLabelsNotRequiringPullRequest");
const isPullRequestDeclaredUnnecessary_1 = require("./isPullRequestDeclaredUnnecessary");
const returnedToAwaitingWorkspaceMessage_1 = require("./returnedToAwaitingWorkspaceMessage");
const isWaitingForOwnerApproval_1 = require("./isWaitingForOwnerApproval");
const awaitingOwnerApprovalMessage_1 = require("./awaitingOwnerApprovalMessage");
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const findLastAgentReport_1 = require("./findLastAgentReport");
const isAgentReportBody_1 = require("./isAgentReportBody");
const issueReactivationTriggerIsPending_1 = require("./issueReactivationTriggerIsPending");
const normalizeReportBody_1 = require("./normalizeReportBody");
const resolveNextStepAgentDispatchRepetition_1 = require("./resolveNextStepAgentDispatchRepetition");
class IssueNotFoundError extends Error {
    constructor(issueUrl) {
        super(`Issue not found: ${issueUrl}`);
        this.name = 'IssueNotFoundError';
    }
}
exports.IssueNotFoundError = IssueNotFoundError;
class IllegalIssueStatusError extends Error {
    constructor(issueUrl, currentStatus, expectedStatus) {
        super(`Illegal issue status for ${issueUrl}: expected ${expectedStatus}, but got ${currentStatus}`);
        this.name = 'IllegalIssueStatusError';
    }
}
exports.IllegalIssueStatusError = IllegalIssueStatusError;
class NotifyFinishedIssuePreparationUseCase {
    constructor(projectRepository, issueRepository, issueCommentRepository, webhookRepository, consoleTabsRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.webhookRepository = webhookRepository;
        this.consoleTabsRepository = consoleTabsRepository;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatusOption) {
                console.error(`Awaiting workspace status option '${WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME}' not found in project.`);
                return;
            }
            const awaitingQualityCheckStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME);
            if (!awaitingQualityCheckStatusOption) {
                console.error(`Awaiting quality check status option '${WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME}' not found in project.`);
                return;
            }
            const failedPreparationStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME);
            if (!failedPreparationStatusOption) {
                console.error(`Failed preparation status option '${WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME}' not found in project.`);
                return;
            }
            const issue = await this.issueRepository.get(params.issueUrl, project);
            if (!issue) {
                throw new IssueNotFoundError(params.issueUrl);
            }
            else if (issue.status !== WorkflowStatus_1.PREPARATION_STATUS_NAME) {
                throw new IllegalIssueStatusError(params.issueUrl, issue.status, WorkflowStatus_1.PREPARATION_STATUS_NAME);
            }
            if (params.deferPreparation) {
                await this.handleTransientFailureDeferral(issue, project, awaitingWorkspaceStatusOption, params.sessionErrorLine ?? null);
                return;
            }
            if (params.missingAgentName) {
                await this.handleMissingAgentDefinition(issue, project, awaitingWorkspaceStatusOption, params.missingAgentName, params.sessionErrorLine ?? null, params.manager ?? null);
                return;
            }
            if (issue.dependedIssueUrls.length === 0) {
                try {
                    const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
                    for (const storyObject of storyObjectMap.values()) {
                        const towerDefenceIssue = storyObject.issues.find((i) => i.url === issue.url);
                        if (towerDefenceIssue) {
                            issue.dependedIssueUrls = towerDefenceIssue.dependedIssueUrls;
                            break;
                        }
                    }
                }
                catch (error) {
                    console.warn('Failed to enrich dependedIssueUrls from story object map:', error);
                }
            }
            if (issue.dependedIssueUrls.length > 0) {
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.issueCommentRepository.createComment(issue, `Issue has dependent issue URLs:\n${issue.dependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                return;
            }
            const evaluatedAt = new Date();
            if ((0, issueReactivationTriggerIsPending_1.issueReactivationTriggerIsPending)(issue, evaluatedAt)) {
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.issueCommentRepository.createComment(issue, `Reactivation trigger not yet reached: nextActionDate=${issue.nextActionDate?.toISOString() ?? 'null'}, nextActionHour=${issue.nextActionHour ?? 'null'}`);
                return;
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const isTrustedAuthor = (author) => this.isAuthorTrusted(author, params.allowedIssueAuthors ?? null);
            const lastAgentReport = (0, findLastAgentReport_1.findLastAgentReport)(comments, isTrustedAuthor);
            const nextStepAgent = lastAgentReport
                ? (0, extractNextStepAgent_1.extractNextStepAgent)(lastAgentReport.content)
                : null;
            if (nextStepAgent !== null) {
                const repetition = (0, resolveNextStepAgentDispatchRepetition_1.resolveNextStepAgentDispatchRepetition)({
                    agentFieldValue: issue.agent,
                    nextStepAgent,
                    comments,
                    isTrustedAuthor,
                    thresholdForAutoReject: params.thresholdForAutoReject,
                    thresholdForDispatchLoop: params.thresholdForDispatchLoop ??
                        resolveNextStepAgentDispatchRepetition_1.DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
                });
                if (repetition.type === 'escalateToFailedPreparation') {
                    issue.status = WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME;
                    await this.issueRepository.update(issue, project);
                    await this.issueRepository.updateStatus(project, issue, failedPreparationStatusOption.id);
                    await this.patchConsoleTab(issue);
                    await this.issueCommentRepository.createComment(issue, repetition.comment);
                    await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                    return;
                }
                const agentOptionId = await this.ensureAgentOptionAndGetId(project, nextStepAgent);
                if (agentOptionId) {
                    await this.issueRepository.setIssueAgentField(params.issueUrl, project, agentOptionId);
                }
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                if (repetition.type === 'dispatchAgain') {
                    await this.issueCommentRepository.createComment(issue, repetition.comment);
                }
                return;
            }
            if (lastAgentReport !== null &&
                (0, isWaitingForOwnerApproval_1.isWaitingForOwnerApproval)(lastAgentReport.content)) {
                const ownerApprovalTimeoutCycles = params.ownerApprovalTimeoutCycles ?? 12;
                const awaitingOwnerApprovalCount = comments.filter((comment) => isTrustedAuthor(comment.author) &&
                    comment.content.startsWith(awaitingOwnerApprovalMessage_1.AWAITING_OWNER_APPROVAL_MESSAGE_HEAD)).length;
                if (awaitingOwnerApprovalCount < ownerApprovalTimeoutCycles) {
                    issue.status = WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
                    await this.issueRepository.update(issue, project);
                    await this.issueRepository.updateStatus(project, issue, awaitingQualityCheckStatusOption.id);
                    await this.patchConsoleTab(issue);
                    await this.issueCommentRepository.createComment(issue, awaitingOwnerApprovalMessage_1.AWAITING_OWNER_APPROVAL_MESSAGE);
                    return;
                }
                issue.status = WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, failedPreparationStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.issueCommentRepository.createComment(issue, `Owner approval was not received after ${ownerApprovalTimeoutCycles} cycles. Moving to Failed Preparation.`);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            const ciFailingPrUrl = await this.resolveLinkedPrWithCiFailure(issue, params.developerAgentName ?? null);
            if (ciFailingPrUrl !== null) {
                const effectiveDeveloperAgentName = params.developerAgentName ?? 'developer';
                const agentOptionId = await this.ensureAgentOptionAndGetId(project, effectiveDeveloperAgentName);
                if (agentOptionId !== null) {
                    await this.issueRepository.setIssueAgentField(params.issueUrl, project, agentOptionId);
                }
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
                await this.issueCommentRepository.createComment(issue, `Auto Status Check: REJECTED\n- ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${ciFailingPrUrl}`);
                return;
            }
            const { rejections, approvedPrUrl } = await this.collectRejections(issue, comments, isTrustedAuthor, (0, resolveLabelsNotRequiringPullRequest_1.resolveLabelsNotRequiringPullRequest)(params), params.developerAgentName);
            const rejectionStatusMessage = rejections.length > 0
                ? `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`
                : 'Auto Status Check: APPROVED';
            const lastTargetComments = comments.slice(-params.thresholdForAutoReject * 2);
            if (rejections.length > 0 &&
                lastTargetComments.filter((comment) => comment.content.startsWith('Auto Status Check: REJECTED') &&
                    isTrustedAuthor(comment.author)).length >= params.thresholdForAutoReject &&
                !lastTargetComments.some((comment) => comment.content
                    .toLowerCase()
                    .includes('failed to pass the check automatically') &&
                    isTrustedAuthor(comment.author))) {
                issue.status = WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, failedPreparationStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
                await this.issueCommentRepository.createComment(issue, `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            if (rejections.length <= 0 &&
                (0, isPullRequestDeclaredUnnecessary_1.isPullRequestDeclaredUnnecessary)(comments, isTrustedAuthor) &&
                !comments.some((comment) => isTrustedAuthor(comment.author) &&
                    comment.content.startsWith(returnedToAwaitingWorkspaceMessage_1.RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD))) {
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.issueCommentRepository.createComment(issue, returnedToAwaitingWorkspaceMessage_1.RETURNED_TO_AWAITING_WORKSPACE_MESSAGE);
                return;
            }
            if (rejections.length <= 0) {
                await this.changeTargetPullRequestApprover.approveIfConfined(issue.labels, approvedPrUrl, params.changeTargetPathAliases);
                issue.status = WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingQualityCheckStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
            await this.issueRepository.update(issue, project);
            await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
            await this.patchConsoleTab(issue);
            await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
            await this.issueCommentRepository.createComment(issue, rejectionStatusMessage);
        };
        this.handleTransientFailureDeferral = async (issue, project, awaitingWorkspaceStatusOption, sessionErrorLine) => {
            const tomorrow = (0, issueReactivationTriggerIsPending_1.issueReactivationTriggerStartOfTomorrow)(new Date());
            await this.issueRepository.updateNextActionDate(issue.url, project, tomorrow);
            issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
            await this.issueRepository.update(issue, project);
            await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
            await this.patchConsoleTab(issue);
            await this.issueCommentRepository.createComment(issue, `Preparation deferred due to transient failure; item reactivates from ${tomorrow.toISOString().split('T')[0]}\nSession stop reason: ${sessionErrorLine ?? '(not captured)'}`);
        };
        this.handleMissingAgentDefinition = async (issue, project, awaitingWorkspaceStatusOption, missingAgentName, sessionErrorLine, manager) => {
            const taskIssueTitle = `Register missing agent definition: ${missingAgentName}`;
            const searchResults = await this.issueRepository.searchIssue({
                owner: issue.org,
                repositoryName: issue.repo,
                type: 'issue',
                state: 'open',
                title: taskIssueTitle,
            });
            const exactMatch = searchResults.find((i) => i.title === taskIssueTitle);
            let taskIssueUrl;
            if (exactMatch) {
                taskIssueUrl = exactMatch.url;
            }
            else {
                const body = [
                    `The preparation worker for ${issue.url} failed because the agent definition \`${missingAgentName}\` was not found.`,
                    '',
                    `- Missing agent name: \`${missingAgentName}\``,
                    `- Failing item: ${issue.url}`,
                    `- Error: ${sessionErrorLine ?? '(not captured)'}`,
                ].join('\n');
                if (!manager) {
                    throw new Error(`'manager' is not configured: cannot create the missing-agent task issue for '${missingAgentName}' without an assignee. Set the 'manager' configuration key to a GitHub username.`);
                }
                const issueNumber = await this.issueRepository.createNewIssue(issue.org, issue.repo, taskIssueTitle, body, [manager], []);
                taskIssueUrl = `https://github.com/${issue.org}/${issue.repo}/issues/${issueNumber}`;
            }
            if (project.dependedIssueUrlSeparatedByComma) {
                await this.issueRepository.setDependedIssueUrl(issue.url, project, taskIssueUrl);
            }
            else {
                console.warn(`dependedIssueUrlSeparatedByComma not configured; cannot block ${issue.url} via ${taskIssueUrl}`);
            }
            issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
            await this.issueRepository.update(issue, project);
            await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
            await this.patchConsoleTab(issue);
            await this.issueCommentRepository.createComment(issue, `Session ended: agent definition \`${missingAgentName}\` was not found.\nItem blocked until the following task issue is resolved:\n${taskIssueUrl}`);
        };
        this.isAuthorTrusted = (author, allowedIssueAuthors) => allowedIssueAuthors === null || allowedIssueAuthors.includes(author);
        this.collectRejections = async (issue, comments, isTrustedAuthor, labelsNotRequiringPullRequest, developerAgentName) => {
            const rejections = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment ||
                !isTrustedAuthor(lastComment.author) ||
                !(0, isAgentReportBody_1.isAgentReportBody)(lastComment.content)) {
                rejections.push({
                    type: 'NO_REPORT_FROM_AGENT_BOT',
                    detail: 'NO_REPORT_FROM_AGENT_BOT',
                });
            }
            else if (this.reportBodyHasNextStep(lastComment.content)) {
                rejections.push({
                    type: 'REPORT_HAS_NEXT_STEP',
                    detail: 'REPORT_HAS_NEXT_STEP',
                });
            }
            const { rejections: prRejections, approvedPrUrl } = await this.issueRejectionEvaluator.evaluate(issue, labelsNotRequiringPullRequest, { developerAgentName });
            const requiredPrRejections = (0, isPullRequestDeclaredUnnecessary_1.isPullRequestDeclaredUnnecessary)(comments, isTrustedAuthor)
                ? prRejections.filter((rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND')
                : prRejections;
            return {
                rejections: [...rejections, ...requiredPrRejections],
                approvedPrUrl,
            };
        };
        this.reportBodyHasNextStep = (body) => {
            const reportMatch = (0, normalizeReportBody_1.normalizeReportBody)(body).match(/```json\n([\s\S]*?)\n```/);
            if (!reportMatch || reportMatch.length < 2) {
                return false;
            }
            let reportJson;
            try {
                reportJson = JSON.parse(reportMatch[1]);
            }
            catch (error) {
                console.warn('Invalid JSON in report body while checking nextStep:', error);
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
        this.setDependedIssueUrlForAllOpenPRs = async (issue, issueUrl, project) => {
            if (!project.dependedIssueUrlSeparatedByComma) {
                console.warn(`dependedIssueUrlSeparatedByComma field not configured in project, skipping depended issue URL update for issue ${issueUrl}`);
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
        this.resolveLinkedPrWithCiFailure = async (issue, developerAgentName) => {
            const effectiveDeveloperName = developerAgentName ?? 'developer';
            if (issue.agent === null ||
                issue.agent === effectiveDeveloperName ||
                issue.agent === 'pr-reviewer') {
                return null;
            }
            let openPrs;
            if (issue.isPr) {
                const pr = await this.issueRepository.getOpenPullRequest(issue.url);
                openPrs = pr === null ? [] : [pr];
            }
            else {
                openPrs = await this.issueRepository.findRelatedOpenPRs(issue.url);
            }
            if (openPrs.length !== 1) {
                return null;
            }
            const pr = openPrs[0];
            return !pr.isPassedAllCiJob ? pr.url : null;
        };
        this.resolveOpenPrsForPrItem = async (prUrl) => {
            const pr = await this.issueRepository.getOpenPullRequest(prUrl);
            if (pr === null) {
                return [];
            }
            return [pr];
        };
        this.sendWorkflowBlockerNotification = async (issueUrl, webhookUrlTemplate, project) => {
            if (webhookUrlTemplate === null) {
                return;
            }
            try {
                const storyObjectMap = await this.issueRepository.getStoryObjectMap(project);
                const isWorkflowBlocker = Array.from(storyObjectMap.entries()).some(([storyName, storyObject]) => storyName.toLowerCase().includes('workflow blocker') &&
                    storyObject.issues.some((issue) => issue.url === issueUrl));
                if (!isWorkflowBlocker) {
                    return;
                }
                const message = `Workflow blocker resolved: ${issueUrl}`;
                const webhookUrl = webhookUrlTemplate
                    .replace('{URL}', encodeURIComponent(issueUrl))
                    .replace('{MESSAGE}', encodeURIComponent(message));
                await this.webhookRepository.sendGetRequest(webhookUrl);
            }
            catch (error) {
                console.warn('Failed to send workflow blocker notification:', error);
            }
        };
        this.resolveConsoleTargetTab = (status) => {
            const lower = status.toLowerCase();
            if (lower === WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME.toLowerCase())
                return 'prs';
            if (lower === WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME.toLowerCase())
                return 'failed-preparation';
            return null;
        };
        this.ensureAgentOptionAndGetId = async (project, agentName) => (0, ensureAgentOptionAndGetId_1.ensureAgentOptionAndGetId)(this.projectRepository, project, agentName);
        this.patchConsoleTab = async (issue) => {
            if (!this.consoleTabsRepository)
                return;
            const targetTabName = this.resolveConsoleTargetTab(issue.status ?? '');
            const relatedOpenPullRequestUrls = !issue.isPr && targetTabName !== null
                ? (await this.issueRepository.findRelatedOpenPRs(issue.url)).map((pr) => pr.url)
                : [];
            const item = {
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
                nextActionDate: issue.nextActionDate === null
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
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
        this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover_1.ChangeTargetPullRequestApprover(issueRepository);
    }
}
exports.NotifyFinishedIssuePreparationUseCase = NotifyFinishedIssuePreparationUseCase;
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.js.map