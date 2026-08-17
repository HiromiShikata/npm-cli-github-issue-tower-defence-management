import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import {
  AWAITING_WORKSPACE_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export class RevertOrphanedInTmuxByAgentIssueUseCase {
  constructor(
    readonly projectRepository: Pick<
      ProjectRepository,
      'findProjectIdByUrl' | 'getProject'
    >,
    readonly issueRepository: Pick<
      IssueRepository,
      'getAllIssues' | 'updateStatus' | 'get'
    >,
    readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listLiveSessionsWithActivity' | 'listInteractiveProcessCommandLines'
    >,
  ) {}

  run = async (params: {
    projectUrl: string;
    now: Date;
    minOrphanAgeSeconds: number;
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

    const { issues } = await this.issueRepository.getAllIssues(projectId);
    const inTmuxByAgentIssues = issues.filter(
      (issue) => issue.status === IN_TMUX_BY_AGENT_STATUS_NAME,
    );
    if (inTmuxByAgentIssues.length === 0) {
      return;
    }

    const liveSessionsWithActivity =
      await this.tmuxSessionRepository.listLiveSessionsWithActivity();
    const liveSessionNames = new Set(
      liveSessionsWithActivity.map((s) => s.sessionName),
    );
    const processCommandLines =
      await this.tmuxSessionRepository.listInteractiveProcessCommandLines();
    const nowSeconds = Math.floor(params.now.getTime() / 1000);

    const issueSessionNames = new Set(
      inTmuxByAgentIssues.map((issue) => toTmuxSessionName(issue.url)),
    );
    const mostRecentWorkspaceSessionActivity = liveSessionsWithActivity
      .filter((s) => !issueSessionNames.has(s.sessionName))
      .reduce((max, s) => Math.max(max, s.activityEpochSeconds), 0);

    for (const issue of inTmuxByAgentIssues) {
      const sessionName = toTmuxSessionName(issue.url);
      if (liveSessionNames.has(sessionName)) {
        continue;
      }
      if (processCommandLines.some((cmd) => cmd.includes(issue.url))) {
        continue;
      }
      if (
        mostRecentWorkspaceSessionActivity >=
        nowSeconds - params.minOrphanAgeSeconds
      ) {
        continue;
      }
      const isStillInTmuxByAgent = await this.isStillInTmuxByAgent(
        issue,
        project,
      );
      if (!isStillInTmuxByAgent) {
        continue;
      }
      await this.issueRepository.updateStatus(
        project,
        issue,
        awaitingWorkspaceStatusOption.id,
      );
    }
  };

  private isStillInTmuxByAgent = async (
    issue: Issue,
    project: Project,
  ): Promise<boolean> => {
    let liveIssue: Issue | null;
    try {
      liveIssue = await this.issueRepository.get(issue.url, project);
    } catch (error) {
      console.error(
        `Failed to re-read the live status before reverting orphaned in-tmux-by-agent issue. issueUrl: ${issue.url}`,
        error,
      );
      return false;
    }
    if (liveIssue === null) {
      console.error(
        `Issue not found while re-reading its live status before reverting orphaned in-tmux-by-agent issue. issueUrl: ${issue.url}`,
      );
      return false;
    }
    return liveIssue.status === IN_TMUX_BY_AGENT_STATUS_NAME;
  };
}
