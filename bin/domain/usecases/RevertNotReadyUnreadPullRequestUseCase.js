"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertNotReadyUnreadPullRequestUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class RevertNotReadyUnreadPullRequestUseCase {
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
            const projectStory = project.story;
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const unreadPullRequests = issues.filter((issue) => issue.status === WorkflowStatus_1.DEFAULT_STATUS_NAME && issue.isPr);
            for (const pullRequest of unreadPullRequests) {
                const hasLlmAgentLabel = pullRequest.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
                if (hasLlmAgentLabel) {
                    continue;
                }
                const { rejections } = await this.issueRejectionEvaluator.evaluate(pullRequest, params.labelsAsLlmAgentName ?? []);
                if (rejections.length > 0) {
                    await this.issueRepository.updateStatus(project, pullRequest, awaitingWorkspaceStatusOption.id);
                    if (projectStory) {
                        await this.issueRepository.updateStory({ ...project, story: projectStory }, pullRequest, projectStory.workflowManagementStory.id);
                    }
                    await this.issueCommentRepository.createComment(pullRequest, `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`);
                }
            }
        };
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
    }
}
exports.RevertNotReadyUnreadPullRequestUseCase = RevertNotReadyUnreadPullRequestUseCase;
//# sourceMappingURL=RevertNotReadyUnreadPullRequestUseCase.js.map