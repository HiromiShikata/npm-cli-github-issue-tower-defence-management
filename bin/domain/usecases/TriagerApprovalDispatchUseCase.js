"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriagerApprovalDispatchUseCase = void 0;
const isAgentReportBody_1 = require("./isAgentReportBody");
const ensureAgentOptionAndGetId_1 = require("./ensureAgentOptionAndGetId");
const isAuthorAuthorizedForAutoStatusCheck_1 = require("./isAuthorAuthorizedForAutoStatusCheck");
const isRecord_1 = require("./isRecord");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const normalizeReportBody_1 = require("./normalizeReportBody");
const TRIAGER_AGENT_NAME = 'triager';
const MAX_COMMENT_FETCHES_PER_CYCLE = 20;
const parseTriagerProposalBlock = (commentContent) => {
    if (!(0, isAgentReportBody_1.isAgentReportBodyFromAgent)(commentContent, TRIAGER_AGENT_NAME)) {
        return null;
    }
    const jsonBlockMatches = [
        ...(0, normalizeReportBody_1.normalizeReportBody)(commentContent).matchAll(/```json\n([\s\S]*?)\n```/g),
    ];
    for (let i = 0; i < jsonBlockMatches.length; i++) {
        const blockContent = jsonBlockMatches[i][1];
        if (!blockContent) {
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(blockContent);
        }
        catch {
            continue;
        }
        if (!(0, isRecord_1.isRecord)(parsed)) {
            continue;
        }
        const proposalValue = parsed['triagerProposal'];
        if (!(0, isRecord_1.isRecord)(proposalValue)) {
            continue;
        }
        if (typeof proposalValue['recommendedAgent'] !== 'string' ||
            typeof proposalValue['recommendedStory'] !== 'string' ||
            typeof proposalValue['storyAlreadySet'] !== 'boolean') {
            continue;
        }
        return {
            recommendedAgent: proposalValue['recommendedAgent'],
            recommendedStory: proposalValue['recommendedStory'],
            storyAlreadySet: proposalValue['storyAlreadySet'],
        };
    }
    return null;
};
const isNotFoundError = (error) => (error instanceof Error ? error.message : String(error)).includes('404');
const isApprovalComment = (content, author, allowedIssueAuthors) => {
    if (!(0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(author, allowedIssueAuthors)) {
        return false;
    }
    if ((0, isAgentReportBody_1.isAgentReportBody)(content)) {
        return false;
    }
    return /^(ok|オーケー|はい[\s\S]*)$/i.test(content.trim());
};
class TriagerApprovalDispatchUseCase {
    constructor(projectRepository, issueRepository, issueCommentRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.run = async (params) => {
            const allowedIssueAuthors = params.allowedIssueAuthors ?? null;
            const cycleIndex = params.cycleIndex ?? Math.floor(Date.now() / 60000);
            const projectId = await this.projectRepository.findProjectIdByUrl(params.projectUrl);
            if (!projectId) {
                throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
            }
            const project = await this.projectRepository.getProject(projectId);
            if (!project) {
                throw new Error(`Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`);
            }
            const awaitingWorkspaceStatus = project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatus) {
                return;
            }
            const { issues } = await this.issueRepository.getAllIssues(projectId);
            const candidateIssues = issues
                .filter((issue) => (issue.status === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME ||
                issue.status === WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME) &&
                (issue.agent === null || issue.agent === TRIAGER_AGENT_NAME) &&
                (0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(issue.author, allowedIssueAuthors))
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            if (candidateIssues.length === 0) {
                return;
            }
            const windowSize = Math.min(MAX_COMMENT_FETCHES_PER_CYCLE, candidateIssues.length);
            const windowStart = (cycleIndex * MAX_COMMENT_FETCHES_PER_CYCLE) % candidateIssues.length;
            for (let slot = 0; slot < windowSize; slot++) {
                const issue = candidateIssues[(windowStart + slot) % candidateIssues.length];
                let comments;
                try {
                    comments =
                        await this.issueCommentRepository.getCommentsFromIssue(issue);
                }
                catch (error) {
                    if (!isNotFoundError(error)) {
                        throw error;
                    }
                    console.warn(`[TriagerApprovalDispatch] Failed to fetch comments, skipping issue for this cycle. issueUrl: ${issue.url} error: ${error instanceof Error ? error.message : String(error)}`);
                    continue;
                }
                let firstProposalIndex = -1;
                let proposal = null;
                for (let i = 0; i < comments.length; i++) {
                    const parsed = parseTriagerProposalBlock(comments[i].content);
                    if (parsed !== null) {
                        if (firstProposalIndex === -1) {
                            firstProposalIndex = i;
                        }
                        proposal = parsed;
                    }
                }
                if (firstProposalIndex === -1 || proposal === null) {
                    console.log(`[TriagerApprovalDispatch] No machine-readable triager proposal block found, skipping. issueUrl: ${issue.url}`);
                    continue;
                }
                let approved = false;
                for (let i = firstProposalIndex + 1; i < comments.length; i++) {
                    const comment = comments[i];
                    if (isApprovalComment(comment.content, comment.author, allowedIssueAuthors ?? [])) {
                        approved = true;
                        break;
                    }
                }
                if (!approved) {
                    continue;
                }
                const agentOptionId = await (0, ensureAgentOptionAndGetId_1.ensureAgentOptionAndGetId)(this.projectRepository, project, proposal.recommendedAgent);
                if (agentOptionId === null) {
                    console.warn(`[TriagerApprovalDispatch] Agent '${proposal.recommendedAgent}' could not be resolved, skipping. issueUrl: ${issue.url}`);
                    continue;
                }
                if (!proposal.storyAlreadySet && project.story) {
                    const storyOption = project.story.stories.find((s) => s.name === proposal.recommendedStory);
                    if (storyOption) {
                        await this.issueRepository.updateStory({ ...project, story: project.story }, issue, storyOption.id);
                    }
                    else {
                        console.warn(`[TriagerApprovalDispatch] Story '${proposal.recommendedStory}' not found in project, skipping story update. issueUrl: ${issue.url}`);
                    }
                }
                await this.issueRepository.setIssueAgentField(issue.url, project, agentOptionId);
                await this.issueRepository.updateStatus(project, issue, awaitingWorkspaceStatus.id);
                await this.issueCommentRepository.createComment(issue, `Auto Status Check: TRIAGER_PROPOSAL_APPROVED\nAgent: ${proposal.recommendedAgent}\nStory: ${proposal.storyAlreadySet ? '(already set)' : proposal.recommendedStory}`);
            }
        };
    }
}
exports.TriagerApprovalDispatchUseCase = TriagerApprovalDispatchUseCase;
//# sourceMappingURL=TriagerApprovalDispatchUseCase.js.map