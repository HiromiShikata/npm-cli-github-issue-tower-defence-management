import { Issue } from '../entities/Issue';
import { LiveTmuxSession } from '../entities/LiveTmuxSession';
import { Project } from '../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_EXCLUDED_STATUS = IN_TMUX_STATUS_NAME;
export const DEFAULT_IDLE_THRESHOLD_SECONDS = 24 * 60 * 60;

type KillCandidate = {
  sessionName: string;
  reason: string;
};

export class StaleTmuxSessionKillUseCase {
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'getAllOpened'>,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listLiveSessionsWithActivity' | 'killSession'
    >,
  ) {}

  run = async (params: {
    project: Project;
    excludedStatus: string;
    idleThresholdSeconds: number;
    now: Date;
  }): Promise<void> => {
    const liveSessions =
      await this.tmuxSessionRepository.listLiveSessionsWithActivity();
    const openIssues = await this.issueRepository.getAllOpened(params.project);
    const issueBySessionName = new Map<string, Issue>();
    for (const issue of openIssues) {
      issueBySessionName.set(toTmuxSessionName(issue.url), issue);
    }

    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const killCandidates: KillCandidate[] = [];
    for (const session of liveSessions) {
      const reason = this.evaluateKillReason(
        session,
        issueBySessionName.get(session.sessionName) ?? null,
        nowEpochSeconds,
        params.excludedStatus,
        params.idleThresholdSeconds,
      );
      if (reason !== null) {
        killCandidates.push({ sessionName: session.sessionName, reason });
      }
    }

    console.log(
      `Stale tmux session cleanup: ${killCandidates.length} kill candidate(s) of ${liveSessions.length} live session(s).`,
    );
    for (const candidate of killCandidates) {
      console.log(
        `Kill candidate: ${candidate.sessionName} (${candidate.reason})`,
      );
    }

    for (const candidate of killCandidates) {
      await this.tmuxSessionRepository.killSession(candidate.sessionName);
      console.log(
        `Killed tmux session: ${candidate.sessionName} (${candidate.reason})`,
      );
    }
  };

  private evaluateKillReason = (
    session: LiveTmuxSession,
    issue: Issue | null,
    nowEpochSeconds: number,
    excludedStatus: string,
    idleThresholdSeconds: number,
  ): string | null => {
    if (issue !== null) {
      if (issue.status !== excludedStatus) {
        return `mapped to open issue ${issue.url} with status "${issue.status ?? 'null'}" which is not the excluded status "${excludedStatus}"`;
      }
      if (issue.nextActionDate !== null) {
        return `mapped to open issue ${issue.url} which has a next action date set`;
      }
      if (issue.nextActionHour !== null) {
        return `mapped to open issue ${issue.url} which has a next action hour set`;
      }
      return null;
    }

    const idleSeconds = nowEpochSeconds - session.activityEpochSeconds;
    if (idleSeconds >= idleThresholdSeconds) {
      return `maps to no open issue and has been idle for ${idleSeconds} seconds (threshold ${idleThresholdSeconds} seconds)`;
    }
    return null;
  };
}
