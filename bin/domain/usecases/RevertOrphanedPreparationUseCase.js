"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertOrphanedPreparationUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
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
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const preparationIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.PREPARATION_STATUS_NAME);
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatusOption) {
                return;
            }
            const resolvedQualityCheckStatusName = params.awaitingQualityCheckStatus ?? WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
            const awaitingQualityCheckStatusOption = project.status.statuses.find((s) => s.name === resolvedQualityCheckStatusName);
            for (const issue of preparationIssues) {
                const isOrphaned = await this.isOrphanedIssue(issue, params);
                if (isOrphaned) {
                    const hasRejections = await this.evaluateHasRejections(issue);
                    if (!hasRejections && awaitingQualityCheckStatusOption) {
                        await this.issueRepository.updateStatus(project, issue, awaitingQualityCheckStatusOption.id);
                    }
                    else {
                        await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    }
                }
            }
        };
        this.evaluateHasRejections = async (issue) => {
            if (issue.isClosed) {
                return false;
            }
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const lastComment = comments[comments.length - 1];
            if (!lastComment || !lastComment.content.startsWith('From:')) {
                return true;
            }
            if (this.reportBodyHasNextStep(lastComment.content)) {
                return true;
            }
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            const hasLlmAgentLabel = issue.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
            if (hasLlmAgentLabel ||
                (categoryLabels.length > 0 && !categoryLabels.includes('category:e2e'))) {
                return false;
            }
            const prsToCheck = issue.isPr
                ? await this.resolveOpenPrsForPrItem(issue.url)
                : await this.issueRepository.findRelatedOpenPRs(issue.url);
            if (prsToCheck.length !== 1) {
                return true;
            }
            const pr = prsToCheck[0];
            return (pr.isConflicted || !pr.isPassedAllCiJob || !pr.isResolvedAllReviewComments);
        };
        this.resolveOpenPrsForPrItem = async (prUrl) => {
            const pr = await this.issueRepository.getOpenPullRequest(prUrl);
            if (pr === null) {
                return [];
            }
            return [pr];
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