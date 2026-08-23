"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertOrphanedPreparationUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const resolveLabelsNotRequiringPullRequest_1 = require("./resolveLabelsNotRequiringPullRequest");
const isPullRequestDeclaredUnnecessary_1 = require("./isPullRequestDeclaredUnnecessary");
const autoStatusCheckComments_1 = require("./autoStatusCheckComments");
const isAuthorAuthorizedForAutoStatusCheck_1 = require("./isAuthorAuthorizedForAutoStatusCheck");
const returnedToAwaitingWorkspaceMessage_1 = require("./returnedToAwaitingWorkspaceMessage");
const extractNextStepAgent_1 = require("./extractNextStepAgent");
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
const ORPHANED_PREPARATION_REJECTION_DETAIL = 'ORPHANED_PREPARATION';
class RevertOrphanedPreparationUseCase {
    constructor(projectRepository, issueRepository, issueCommentRepository, localCommandRunner) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.localCommandRunner = localCommandRunner;
        this.run = async (params) => {
            const projectId = await this.projectRepository.findProjectIdByUrl(params.projectUrl);
            if (!projectId) {
                throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new Error(`Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`);
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId);
            const preparationIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.PREPARATION_STATUS_NAME);
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatusOption) {
                return;
            }
            const resolvedQualityCheckStatusName = params.awaitingQualityCheckStatus ?? WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
            const awaitingQualityCheckStatusOption = project.status.statuses.find((s) => s.name === resolvedQualityCheckStatusName);
            const failedPreparationStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME);
            for (const issue of preparationIssues) {
                const isOrphaned = await this.isOrphanedIssue(issue, params);
                if (!isOrphaned) {
                    continue;
                }
                const { outcome, comments } = await this.evaluateOutcome(issue, (0, resolveLabelsNotRequiringPullRequest_1.resolveLabelsNotRequiringPullRequest)(params), params.allowedIssueAuthors);
                const isStillInPreparation = await this.isStillInPreparation(issue, project);
                if (!isStillInPreparation) {
                    continue;
                }
                const nextStepAgent = this.resolveNextStepAgent(comments, params.allowedIssueAuthors);
                if (nextStepAgent !== null) {
                    const agentOptionId = await (0, ensureAgentOptionAndGetId_1.ensureAgentOptionAndGetId)(this.projectRepository, project, nextStepAgent);
                    if (agentOptionId !== null) {
                        await this.issueRepository.setIssueAgentField(issue.url, project, agentOptionId);
                    }
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    continue;
                }
                if (outcome === 'returnToLabelSelectedAgent') {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    await this.issueCommentRepository.createComment(issue, returnedToAwaitingWorkspaceMessage_1.RETURNED_TO_AWAITING_WORKSPACE_MESSAGE);
                    continue;
                }
                if (outcome === 'advanceToQualityCheck') {
                    if (awaitingQualityCheckStatusOption) {
                        await this.issueRepository.updateStatus(project, issue, awaitingQualityCheckStatusOption.id);
                    }
                    else {
                        await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    }
                    continue;
                }
                const rejectionStatusMessage = `Auto Status Check: REJECTED\n- ${ORPHANED_PREPARATION_REJECTION_DETAIL}`;
                const lastTargetComments = comments.slice(-params.thresholdForAutoReject * 2);
                const rejectionCommentCount = lastTargetComments.filter((comment) => comment.content.startsWith('Auto Status Check: REJECTED')).length;
                const alreadyEscalated = lastTargetComments.some((comment) => comment.content
                    .toLowerCase()
                    .includes('failed to pass the check automatically'));
                if (failedPreparationStatusOption &&
                    rejectionCommentCount + 1 >= params.thresholdForAutoReject &&
                    !alreadyEscalated) {
                    await this.issueRepository.updateStatus(project, issue, failedPreparationStatusOption.id);
                    await this.issueCommentRepository.createComment(issue, `${rejectionStatusMessage}\n\nFailed to pass the check automatically for ${params.thresholdForAutoReject} times`);
                    continue;
                }
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.issueCommentRepository.createComment(issue, rejectionStatusMessage);
            }
        };
        this.isStillInPreparation = async (issue, project) => {
            let liveIssue;
            try {
                liveIssue = await this.issueRepository.get(issue.url, project);
            }
            catch (error) {
                console.error(`Failed to re-read the live status before reverting orphaned preparation. issueUrl: ${issue.url}`, error);
                return false;
            }
            if (liveIssue === null) {
                console.error(`Issue not found while re-reading its live status before reverting orphaned preparation. issueUrl: ${issue.url}`);
                return false;
            }
            return liveIssue.status === WorkflowStatus_1.PREPARATION_STATUS_NAME;
        };
        this.evaluateOutcome = async (issue, labelsNotRequiringPullRequest, allowedIssueAuthors) => {
            if (issue.isClosed) {
                return { outcome: 'advanceToQualityCheck', comments: [] };
            }
            let comments;
            try {
                comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            }
            catch (error) {
                console.error(`Failed to fetch comments for orphaned preparation issue ${issue.url}, reverting to Awaiting Workspace:`, error);
                return { outcome: 'reject', comments: [] };
            }
            const isTrustedAuthor = (author) => (0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(author, allowedIssueAuthors);
            const commentsBeforeOwnStatusComments = (0, autoStatusCheckComments_1.dropTrailingAutoStatusCheckComments)(comments, isTrustedAuthor);
            const lastReport = commentsBeforeOwnStatusComments[commentsBeforeOwnStatusComments.length - 1] ?? null;
            if (lastReport !== null &&
                (0, isPullRequestDeclaredUnnecessary_1.isPullRequestDeclaredUnnecessary)(commentsBeforeOwnStatusComments, isTrustedAuthor) &&
                !this.reportBodyHasNextStep(lastReport.content)) {
                const alreadyReturnedToWorkspace = comments.some((comment) => isTrustedAuthor(comment.author) &&
                    comment.content.startsWith(returnedToAwaitingWorkspaceMessage_1.RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD));
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
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            const isNonDeveloperAgent = issue.agent != null && issue.agent !== 'developer';
            const hasLabelNotRequiringPullRequest = issue.labels.some((label) => labelsNotRequiringPullRequest.includes(label));
            if (isNonDeveloperAgent ||
                hasLabelNotRequiringPullRequest ||
                (categoryLabels.length > 0 && !categoryLabels.includes('category:e2e'))) {
                return { outcome: 'advanceToQualityCheck', comments };
            }
            const prsToCheck = issue.isPr
                ? await this.resolveOpenPrsForPrItem(issue.url)
                : await this.issueRepository.findRelatedOpenPRs(issue.url);
            if (prsToCheck.length !== 1) {
                return { outcome: 'reject', comments };
            }
            const pr = prsToCheck[0];
            const hasRejections = pr.isConflicted ||
                !pr.isPassedAllCiJob ||
                !pr.isResolvedAllReviewComments;
            return {
                outcome: hasRejections ? 'reject' : 'advanceToQualityCheck',
                comments,
            };
        };
        this.resolveOpenPrsForPrItem = async (prUrl) => {
            const pr = await this.issueRepository.getOpenPullRequest(prUrl);
            if (pr === null) {
                return [];
            }
            return [pr];
        };
        this.resolveNextStepAgent = (comments, allowedIssueAuthors) => {
            const lastReportComment = [...comments]
                .reverse()
                .find((comment) => (0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(comment.author, allowedIssueAuthors) && comment.content.startsWith('From: :robot:'));
            return lastReportComment
                ? (0, extractNextStepAgent_1.extractNextStepAgent)(lastReportComment.content)
                : null;
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
        this.isOrphanedIssue = async (issue, params) => {
            const commandTemplate = params.preparationProcessCheckCommand.replace('{URL}', '$1');
            const { exitCode } = await this.localCommandRunner.runCommand('sh', [
                '-c',
                commandTemplate,
                '--',
                issue.url,
            ]);
            if (exitCode !== 0)
                return true;
            const { awLogDirectoryPath, awLogStaleThresholdMinutes } = params;
            if (!awLogDirectoryPath || !awLogStaleThresholdMinutes)
                return false;
            return this.isAwLogStale(issue, awLogDirectoryPath, awLogStaleThresholdMinutes);
        };
        this.isAwLogStale = async (issue, awLogDirectoryPath, awLogStaleThresholdMinutes) => {
            const logPattern = `${issue.org}_${issue.repo}_${issue.number}_*`;
            const { stdout: anyFilesOutput, exitCode: anyFilesExitCode } = await this.localCommandRunner.runCommand('sh', [
                '-c',
                'find "$1" -name "$2"',
                '--',
                awLogDirectoryPath,
                logPattern,
            ]);
            if (anyFilesExitCode !== 0 || !anyFilesOutput.trim())
                return false;
            const { stdout: recentFilesOutput, exitCode: recentFilesExitCode } = await this.localCommandRunner.runCommand('sh', [
                '-c',
                'find "$1" -name "$2" -mmin -$3',
                '--',
                awLogDirectoryPath,
                logPattern,
                String(awLogStaleThresholdMinutes),
            ]);
            if (recentFilesExitCode !== 0)
                return false;
            return !recentFilesOutput.trim();
        };
    }
}
exports.RevertOrphanedPreparationUseCase = RevertOrphanedPreparationUseCase;
//# sourceMappingURL=RevertOrphanedPreparationUseCase.js.map