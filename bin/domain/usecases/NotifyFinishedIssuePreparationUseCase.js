"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifyFinishedIssuePreparationUseCase = exports.IllegalIssueStatusError = exports.IssueNotFoundError = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
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
    constructor(projectRepository, issueRepository, issueCommentRepository, webhookRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.webhookRepository = webhookRepository;
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
                    const storyObjectMap = await this.issueRepository.getStoryObjectMap(project, 0);
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
                await this.issueCommentRepository.createComment(issue, `Issue has dependent issue URLs: ${issue.dependedIssueUrls.join(', ')}`);
                return;
            }
            if (issue.nextActionDate !== null || issue.nextActionHour !== null) {
                issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.issueCommentRepository.createComment(issue, `Issue has next action date or hour set: nextActionDate=${issue.nextActionDate?.toISOString() ?? 'null'}, nextActionHour=${issue.nextActionHour ?? 'null'}`);
                return;
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const { rejections } = await this.collectRejections(issue, comments);
            const rejectionStatusMessage = rejections.length > 0
                ? `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`
                : 'Auto Status Check: APPROVED';
            const lastTargetComments = comments.slice(-params.thresholdForAutoReject * 2);
            if (rejections.length > 0 &&
                lastTargetComments.filter((comment) => comment.content.startsWith('Auto Status Check: REJECTED')).length >= params.thresholdForAutoReject &&
                !lastTargetComments.some((comment) => comment.content
                    .toLowerCase()
                    .includes('failed to pass the check automatically'))) {
                issue.status = WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, failedPreparationStatusOption.id);
                await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
                await this.issueCommentRepository.createComment(issue, `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            if (rejections.length <= 0) {
                issue.status = WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
                await this.issueRepository.update(issue, project);
                await this.issueRepository.updateStatus(project, issue, awaitingQualityCheckStatusOption.id);
                await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
                await this.sendWorkflowBlockerNotification(params.issueUrl, params.workflowBlockerResolvedWebhookUrl, project);
                return;
            }
            issue.status = WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME;
            await this.issueRepository.update(issue, project);
            await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
            await this.setDependedIssueUrlForAllOpenPRs(issue, params.issueUrl, project);
            await this.issueCommentRepository.createComment(issue, rejectionStatusMessage);
        };
        this.collectRejections = async (issue, comments) => {
            const rejections = [];
            const lastComment = comments[comments.length - 1];
            if (!lastComment || !lastComment.content.startsWith('From: :robot:')) {
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
            const { rejections: prRejections, approvedPrUrl } = await this.issueRejectionEvaluator.evaluate(issue);
            return { rejections: [...rejections, ...prRejections], approvedPrUrl };
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
                const storyObjectMap = await this.issueRepository.getStoryObjectMap(project, 0);
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
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
    }
}
exports.NotifyFinishedIssuePreparationUseCase = NotifyFinishedIssuePreparationUseCase;
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.js.map