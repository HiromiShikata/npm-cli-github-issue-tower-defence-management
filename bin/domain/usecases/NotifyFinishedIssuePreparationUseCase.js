"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyFinishedIssuePreparationUseCase = exports.IllegalIssueStatusError = exports.IssueNotFoundError = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const ChangeTargetPullRequestApprover_1 = require("./ChangeTargetPullRequestApprover");
const resolveLabelsNotRequiringPullRequest_1 = require("./resolveLabelsNotRequiringPullRequest");
const isPullRequestDeclaredUnnecessary_1 = require("./isPullRequestDeclaredUnnecessary");
const returnedToAwaitingWorkspaceMessage_1 = require("./returnedToAwaitingWorkspaceMessage");
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
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
            if (issue.nextActionDate !== null || issue.nextActionHour !== null) {
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.patchConsoleTab(issue);
                await this.issueCommentRepository.createComment(issue, `Issue has next action date or hour set: nextActionDate=${issue.nextActionDate?.toISOString() ?? 'null'}, nextActionHour=${issue.nextActionHour ?? 'null'}`);
                return;
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const isTrustedAuthor = (author) => this.isAuthorTrusted(author, params.allowedIssueAuthors ?? null);
            const lastTrustedBotComment = [...comments]
                .reverse()
                .find((c) => isTrustedAuthor(c.author) && c.content.startsWith('From: :robot:'));
            const nextStepAgent = lastTrustedBotComment
                ? this.extractNextStepAgent(lastTrustedBotComment.content)
                : null;
            if (nextStepAgent !== null) {
                const agentOptionId = await this.ensureAgentOptionAndGetId(project, nextStepAgent);
                if (agentOptionId) {
                    await this.issueRepository.setIssueAgentField(params.issueUrl, project, agentOptionId);
                }
                await this.issueRepository.getOrCreateLabel(issue.org, issue.repo, nextStepAgent);
                const agentLabels = params.labelsAsLlmAgentName ?? [];
                const filteredLabels = issue.labels.filter((label) => !label.startsWith('llm-agent:') && !agentLabels.includes(label));
                const updatedLabels = [...new Set([...filteredLabels, nextStepAgent])];
                issue.labels = updatedLabels;
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.issueRepository.updateLabels(issue, updatedLabels);
                await this.patchConsoleTab(issue);
                return;
            }
            const { rejections, approvedPrUrl } = await this.collectRejections(issue, comments, isTrustedAuthor, (0, resolveLabelsNotRequiringPullRequest_1.resolveLabelsNotRequiringPullRequest)(params));
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
        this.isAuthorTrusted = (author, allowedIssueAuthors) => allowedIssueAuthors === null || allowedIssueAuthors.includes(author);
        this.collectRejections = async (issue, comments, isTrustedAuthor, labelsNotRequiringPullRequest) => {
            const rejections = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment ||
                !isTrustedAuthor(lastComment.author) ||
                !lastComment.content.startsWith('From: :robot:')) {
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
            const { rejections: prRejections, approvedPrUrl } = await this.issueRejectionEvaluator.evaluate(issue, labelsNotRequiringPullRequest);
            const requiredPrRejections = (0, isPullRequestDeclaredUnnecessary_1.isPullRequestDeclaredUnnecessary)(comments, isTrustedAuthor)
                ? prRejections.filter((rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND')
                : prRejections;
            return {
                rejections: [...rejections, ...requiredPrRejections],
                approvedPrUrl,
            };
        };
        this.reportBodyHasNextStep = (body) => {
            const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
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
        this.extractNextStepAgent = (body) => {
            const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
            if (!reportMatch || reportMatch.length < 2) {
                return null;
            }
            let reportJson;
            try {
                reportJson = JSON.parse(reportMatch[1]);
            }
            catch (error) {
                console.warn('Invalid JSON in report body while checking nextStepAgent:', error);
                return null;
            }
            if (typeof reportJson !== 'object' || reportJson === null) {
                return null;
            }
            if (!('nextStepAgent' in reportJson)) {
                return null;
            }
            const value = Reflect.get(reportJson, 'nextStepAgent');
            if (typeof value !== 'string' || value.trim() === '') {
                return null;
            }
            return value.trim();
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