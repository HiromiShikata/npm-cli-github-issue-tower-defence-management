import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { IssueRejectionEvaluator } from './IssueRejectionEvaluator';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  DEFAULT_STATUS_NAME,
} from '../entities/WorkflowStatus';

export class RevertNotReadyUnreadPullRequestUseCase {
  private readonly issueRejectionEvaluator: IssueRejectionEvaluator;

  constructor(
    private readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    private readonly issueRepository: Pick<
      IssueRepository,
      | 'getAllIssues'
      | 'updateStatus'
      | 'updateStory'
      | 'findRelatedOpenPRs'
      | 'getOpenPullRequest'
    >,
    private readonly issueCommentRepository: Pick<
      IssueCommentRepository,
      'createComment'
    >,
  ) {
    this.issueRejectionEvaluator = new IssueRejectionEvaluator(issueRepository);
  }

  run = async (params: {
    projectUrl: string;
    allowIssueCacheMinutes: number;
  }): Promise<void> => {
    const projectId = await this.projectRepository.findProjectIdByUrl(
      params.projectUrl,
    );
    if (!projectId) {
      throw new Error(`Project not found. projectUrl: ${params.projectUrl}`);
    }
    const project = await this.projectRepository.getProject(projectId);
    if (!project) {
      throw new Error(
        `Project not found. projectId: ${projectId} projectUrl: ${params.projectUrl}`,
      );
    }

    const awaitingWorkspaceStatusOption = project.status.statuses.find(
      (s) => s.name === AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (!awaitingWorkspaceStatusOption) {
      return;
    }

    const projectStory = project.story;

    const { issues } = await this.issueRepository.getAllIssues(
      projectId,
      params.allowIssueCacheMinutes,
    );

    const unreadPullRequests = issues.filter(
      (issue) => issue.status === DEFAULT_STATUS_NAME && issue.isPr,
    );

    for (const pullRequest of unreadPullRequests) {
      const hasLlmAgentLabel = pullRequest.labels.some(
        (l) => l === 'llm-agent' || l.startsWith('llm-agent:'),
      );
      if (hasLlmAgentLabel) {
        continue;
      }

      const { rejections } =
        await this.issueRejectionEvaluator.evaluate(pullRequest);
      if (rejections.length > 0) {
        await this.issueRepository.updateStatus(
          project,
          pullRequest,
          awaitingWorkspaceStatusOption.id,
        );
        if (projectStory) {
          await this.issueRepository.updateStory(
            { ...project, story: projectStory },
            pullRequest,
            projectStory.workflowManagementStory.id,
          );
        }
        await this.issueCommentRepository.createComment(
          pullRequest,
          `Auto Status Check: REJECTED\n${rejections.map((r) => `- ${r.detail}`).join('\n')}`,
        );
      }
    }
  };
}
