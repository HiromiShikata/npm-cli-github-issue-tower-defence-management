"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertNotReadyAwaitingQualityCheckUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const ChangeTargetPullRequestApprover_1 = require("./ChangeTargetPullRequestApprover");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class RevertNotReadyAwaitingQualityCheckUseCase {
    constructor(projectRepository, issueRepository, issueCommentRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.run = async (params) => {
            const projectId = await this.projectRepository.findProjectIdByUrl(params.projectUrl);
            if (!projectId) {
                throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new Error(`Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`);
            }
            const awaitingWorkspaceStatusOption = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatusOption) {
                return;
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const awaitingQualityCheckIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME);
            for (const issue of awaitingQualityCheckIssues) {
                const hasLlmAgentLabel = issue.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
                if (hasLlmAgentLabel) {
                    continue;
                }
                const { rejections, approvedPrUrl } = await this.issueRejectionEvaluator.evaluate(issue);
                if (rejections.length > 0) {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    await this.issueCommentRepository.createComment(issue, `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`);
                    continue;
                }
                await this.changeTargetPullRequestApprover.approveIfConfined(issue.labels, approvedPrUrl);
            }
        };
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
        this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover_1.ChangeTargetPullRequestApprover(issueRepository);
    }
}
exports.RevertNotReadyAwaitingQualityCheckUseCase = RevertNotReadyAwaitingQualityCheckUseCase;
//# sourceMappingURL=RevertNotReadyAwaitingQualityCheckUseCase.js.map