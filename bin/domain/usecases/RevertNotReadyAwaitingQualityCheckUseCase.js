"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevertNotReadyAwaitingQualityCheckUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const ChangeTargetPullRequestApprover_1 = require("./ChangeTargetPullRequestApprover");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const STORY_COLOR_HEX_MAP = {
    GRAY: '#6e7781',
    BLUE: '#0075ca',
    GREEN: '#0a8a47',
    YELLOW: '#d4a72c',
    ORANGE: '#e4660a',
    RED: '#cf222e',
    PINK: '#e85aad',
    PURPLE: '#8250df',
};
const extractPrRepoFromUrl = (prUrl) => {
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
        throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
    }
    return `${match[1]}/${match[2]}`;
};
const extractDirectoryFromFilePath = (filePath) => {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.slice(0, lastSlash) : '.';
};
const extractChangedDirectories = (filePaths) => {
    const dirs = new Set();
    for (const filePath of filePaths) {
        dirs.add(extractDirectoryFromFilePath(filePath));
    }
    return Array.from(dirs);
};
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
                return null;
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId, params.allowIssueCacheMinutes);
            const awaitingQualityCheckIssues = issues.filter((issue) => issue.status === WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME);
            const viewerItems = [];
            for (const issue of awaitingQualityCheckIssues) {
                const hasLlmAgentLabel = issue.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
                if (hasLlmAgentLabel) {
                    continue;
                }
                const { rejections, approvedPrUrl, readyPr } = await this.issueRejectionEvaluator.evaluate(issue, params.labelsAsLlmAgentName ?? []);
                if (rejections.length > 0) {
                    await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatusOption.id);
                    await this.issueCommentRepository.createComment(issue, `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`);
                    continue;
                }
                await this.changeTargetPullRequestApprover.approveIfConfined(issue.labels, approvedPrUrl);
                if (params.awaitingQualityCheckViewerOutputPath &&
                    readyPr &&
                    issue.assignees.includes('HiromiShikata') &&
                    issue.nextActionDate === null &&
                    issue.nextActionHour === null &&
                    !params.donePrUrls?.has(readyPr.url)) {
                    const filePaths = await this.issueRepository.getPullRequestChangedFilePaths(readyPr.url);
                    const changedDirectories = extractChangedDirectories(filePaths);
                    viewerItems.push({
                        issue: {
                            number: issue.number,
                            title: issue.title,
                            author: issue.author,
                            url: issue.url,
                            story: issue.story ?? null,
                            projectItemId: issue.itemId,
                        },
                        pr: {
                            number: readyPr.number,
                            repo: extractPrRepoFromUrl(readyPr.url),
                            title: readyPr.title,
                            additions: readyPr.additions,
                            deletions: readyPr.deletions,
                            changedFiles: readyPr.changedFiles,
                            url: readyPr.url,
                        },
                        changedDirectories,
                    });
                }
            }
            if (!params.awaitingQualityCheckViewerOutputPath) {
                return null;
            }
            const stories = project.story?.stories.map((s, index) => ({
                name: s.name,
                color: STORY_COLOR_HEX_MAP[s.color],
                order: index,
            })) ?? [];
            return {
                stories,
                items: viewerItems,
            };
        };
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
        this.changeTargetPullRequestApprover = new ChangeTargetPullRequestApprover_1.ChangeTargetPullRequestApprover(issueRepository);
    }
}
exports.RevertNotReadyAwaitingQualityCheckUseCase = RevertNotReadyAwaitingQualityCheckUseCase;
//# sourceMappingURL=RevertNotReadyAwaitingQualityCheckUseCase.js.map