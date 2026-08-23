import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { ensureAgentOptionAndGetId } from './ensureAgentOptionAndGetId';
import { isAuthorAuthorizedForAutoStatusCheck } from './isAuthorAuthorizedForAutoStatusCheck';
import {
  AWAITING_QUALITY_CHECK_STATUS_NAME,
  AWAITING_WORKSPACE_STATUS_NAME,
} from '../entities/WorkflowStatus';

const AGENT_REPORT_PREFIX = 'From: :robot:';
const TRIAGER_AGENT_NAME = 'triager';

type TriagerProposal = {
  recommendedAgent: string;
  recommendedStory: string;
  storyAlreadySet: boolean;
};

const parseTriagerProposalBlock = (
  commentContent: string,
): TriagerProposal | null => {
  if (
    !commentContent.startsWith(`${AGENT_REPORT_PREFIX} ${TRIAGER_AGENT_NAME}`)
  ) {
    return null;
  }
  const jsonBlockMatches = [
    ...commentContent.matchAll(/```json\n([\s\S]*?)\n```/g),
  ];
  for (let i = 1; i < jsonBlockMatches.length; i++) {
    const blockContent = jsonBlockMatches[i][1];
    if (!blockContent) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(blockContent);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }
    const obj = parsed as Record<string, unknown>;
    const proposalValue = obj['triagerProposal'];
    if (typeof proposalValue !== 'object' || proposalValue === null) {
      continue;
    }
    const p = proposalValue as Record<string, unknown>;
    if (
      typeof p['recommendedAgent'] !== 'string' ||
      typeof p['recommendedStory'] !== 'string' ||
      typeof p['storyAlreadySet'] !== 'boolean'
    ) {
      continue;
    }
    return {
      recommendedAgent: p['recommendedAgent'],
      recommendedStory: p['recommendedStory'],
      storyAlreadySet: p['storyAlreadySet'],
    };
  }
  return null;
};

const isApprovalComment = (
  content: string,
  author: string,
  allowedIssueAuthors: string[],
): boolean => {
  if (!isAuthorAuthorizedForAutoStatusCheck(author, allowedIssueAuthors)) {
    return false;
  }
  if (content.startsWith(AGENT_REPORT_PREFIX)) {
    return false;
  }
  return /^(ok|オーケー)$/i.test(content.trim());
};

export class TriagerApprovalDispatchUseCase {
  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      | 'findProjectIdByUrl'
      | 'getProject'
      | 'createField'
      | 'getByUrl'
      | 'updateAgentList'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'updateStatus' | 'updateStory' | 'setIssueAgentField'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'getCommentsFromIssue' | 'createComment'
    >,
  ) {}

  run = async (params: {
    projectUrl: string;
    allowedIssueAuthors?: string[] | null;
  }): Promise<void> => {
    const allowedIssueAuthors = params.allowedIssueAuthors ?? null;

    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(
        `Project not found. projectUrl: ${params.projectUrl}`,
      );
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }

    const awaitingWorkspaceStatus = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatus) {
      return;
    }

    const { issues } = await this.issueRepository.getAllIssues(projectId);

    const candidateIssues = issues.filter(
      (issue) =>
        (issue.status === AWAITING_WORKSPACE_STATUS_NAME ||
          issue.status === AWAITING_QUALITY_CHECK_STATUS_NAME) &&
        issue.agent === null &&
        isAuthorAuthorizedForAutoStatusCheck(issue.author, allowedIssueAuthors),
    );

    for (const issue of candidateIssues) {
      const comments =
        await this.issueCommentRepository.getCommentsFromIssue(issue);

      let proposalCommentIndex = -1;
      let proposal: TriagerProposal | null = null;
      for (let i = 0; i < comments.length; i++) {
        const parsed = parseTriagerProposalBlock(comments[i].content);
        if (parsed !== null) {
          proposalCommentIndex = i;
          proposal = parsed;
        }
      }

      if (proposalCommentIndex === -1 || proposal === null) {
        console.log(
          `[TriagerApprovalDispatch] No machine-readable triager proposal block found, skipping. issueUrl: ${issue.url}`,
        );
        continue;
      }

      let approved = false;
      for (
        let i = proposalCommentIndex + 1;
        i < comments.length;
        i++
      ) {
        const comment = comments[i];
        if (
          isApprovalComment(
            comment.content,
            comment.author,
            allowedIssueAuthors ?? [],
          )
        ) {
          approved = true;
          break;
        }
      }

      if (!approved) {
        continue;
      }

      const agentOptionId = await ensureAgentOptionAndGetId(
        this.projectRepository,
        project,
        proposal.recommendedAgent,
      );
      if (agentOptionId === null) {
        console.warn(
          `[TriagerApprovalDispatch] Agent '${proposal.recommendedAgent}' could not be resolved, skipping. issueUrl: ${issue.url}`,
        );
        continue;
      }

      if (!proposal.storyAlreadySet && project.story) {
        const storyOption = project.story.stories.find(
          (s) => s.name === proposal.recommendedStory,
        );
        if (storyOption) {
          await this.issueRepository.updateStory(
            { ...project, story: project.story },
            issue,
            storyOption.id,
          );
        } else {
          console.warn(
            `[TriagerApprovalDispatch] Story '${proposal.recommendedStory}' not found in project, skipping story update. issueUrl: ${issue.url}`,
          );
        }
      }

      await this.issueRepository.setIssueAgentField(
        issue.url,
        project,
        agentOptionId,
      );

      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatus.id,
      );

      await this.issueCommentRepository.createComment(
        issue,
        `Auto Status Check: TRIAGER_PROPOSAL_APPROVED\nAgent: ${proposal.recommendedAgent}\nStory: ${proposal.storyAlreadySet ? '(already set)' : proposal.recommendedStory}`,
      );
    }
  };
}
