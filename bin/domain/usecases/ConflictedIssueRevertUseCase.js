"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictedIssueRevertUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const EXCLUDED_STATUSES = new Set([
    WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME,
    WorkflowStatus_1.DONE_STATUS_NAME,
    WorkflowStatus_1.ICEBOX_STATUS_NAME,
    WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME,
    WorkflowStatus_1.IN_TMUX_STATUS_NAME,
]);
class ConflictedIssueRevertUseCase {
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
            const { issues } = await this.issueRepository.getAllIssues(projectId);
            const targetIssues = issues.filter((issue) => !issue.isPr &&
                (issue.status === null || !EXCLUDED_STATUSES.has(issue.status)));
            const relatedOpenPrUrlsByIssueUrl = this.buildRelatedOpenPrUrlsByIssueUrl(issues);
            const allPrUrls = Array.from(new Set(targetIssues.flatMap((issue) => relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [])));
            if (allPrUrls.length === 0) {
                return;
            }
            const resolvedPrByUrl = await this.issueRepository.getOpenPullRequests(allPrUrls);
            for (const issue of targetIssues) {
                const prUrls = relatedOpenPrUrlsByIssueUrl.get(issue.url) ?? [];
                if (prUrls.length === 0) {
                    continue;
                }
                const relatedPrs = prUrls
                    .map((url) => resolvedPrByUrl.get(url) ?? null)
                    .filter((pr) => pr !== null);
                const hasUnknownMergeable = relatedPrs.some((pr) => pr.mergeable === 'UNKNOWN');
                if (hasUnknownMergeable) {
                    continue;
                }
                const hasConflict = relatedPrs.some((pr) => pr.isConflicted);
                if (!hasConflict) {
                    continue;
                }
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                await this.issueCommentRepository.createComment(issue, 'conflict');
            }
        };
        this.buildRelatedOpenPrUrlsByIssueUrl = (issues) => {
            const openPrUrlsByIssueUrl = new Map();
            for (const issue of issues) {
                if (!issue.isPr || issue.isClosed) {
                    continue;
                }
                for (const referencedIssueUrl of issue.closingIssueReferenceUrls) {
                    const existing = openPrUrlsByIssueUrl.get(referencedIssueUrl);
                    if (existing) {
                        existing.add(issue.url);
                    }
                    else {
                        openPrUrlsByIssueUrl.set(referencedIssueUrl, new Set([issue.url]));
                    }
                }
            }
            const result = new Map();
            for (const [issueUrl, prUrls] of openPrUrlsByIssueUrl) {
                result.set(issueUrl, Array.from(prUrls));
            }
            return result;
        };
    }
}
exports.ConflictedIssueRevertUseCase = ConflictedIssueRevertUseCase;
//# sourceMappingURL=ConflictedIssueRevertUseCase.js.map