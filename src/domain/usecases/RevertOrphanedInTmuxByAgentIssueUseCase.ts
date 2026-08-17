import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { AgentHeartbeatRepository } from './adapter-interfaces/AgentHeartbeatRepository';
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
      'listLiveSessionNames' | 'listInteractiveProcessCommandLines'
    >,
    readonly agentHeartbeatRepository: AgentHeartbeatRepository,
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

    const liveSessionNames = new Set(
      await this.tmuxSessionRepository.listLiveSessionNames(),
    );
    const processCommandLines =
      await this.tmuxSessionRepository.listInteractiveProcessCommandLines();
    const nowSeconds = Math.floor(params.now.getTime() / 1000);

    for (const issue of inTmuxByAgentIssues) {
      const sessionName = toTmuxSessionName(issue.url);
      if (liveSessionNames.has(sessionName)) {
        await this.agentHeartbeatRepository.writeHeartbeat(
          issue.url,
          nowSeconds,
        );
        await this.agentHeartbeatRepository.deleteOrphanCandidate(issue.url);
        continue;
      }
      if (processCommandLines.some((cmd) => cmd.includes(issue.url))) {
        await this.agentHeartbeatRepository.writeHeartbeat(
          issue.url,
          nowSeconds,
        );
        await this.agentHeartbeatRepository.deleteOrphanCandidate(issue.url);
        continue;
      }

      // No direct live-agent evidence. Use the orphan-candidate timestamp — a
      // value this sweep writes itself — so the reclaim decision never rests on
      // the absence of a signal that external code is supposed to write.
      const orphanCandidateSeconds =
        await this.agentHeartbeatRepository.readOrphanCandidateEpochSeconds(
          issue.url,
        );
      if (orphanCandidateSeconds === null) {
        // First time this sweep notices a potential orphan. Record the time and
        // give the agent a full grace period before reconsidering.
        await this.agentHeartbeatRepository.writeOrphanCandidate(
          issue.url,
          nowSeconds,
        );
        continue;
      }
      if (orphanCandidateSeconds >= nowSeconds - params.minOrphanAgeSeconds) {
        // Within grace period — do not reclaim yet.
        continue;
      }

      // Orphan candidate is old. A fresh heartbeat (voluntarily written by a
      // workspace-leader agent) still prevents reclaim.
      const heartbeatSeconds =
        await this.agentHeartbeatRepository.readHeartbeatEpochSeconds(
          issue.url,
        );
      if (
        heartbeatSeconds !== null &&
        heartbeatSeconds >= nowSeconds - params.minOrphanAgeSeconds
      ) {
        await this.agentHeartbeatRepository.deleteOrphanCandidate(issue.url);
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
      await this.agentHeartbeatRepository.deleteOrphanCandidate(issue.url);
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
