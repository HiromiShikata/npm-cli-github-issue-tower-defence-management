import { issueSessionIsOnHold } from './issueSessionIsOnHold';
import { Issue } from '../entities/Issue';
import { LiveTmuxSession } from '../entities/LiveTmuxSession';
import { Project } from '../entities/Project';
import {
  IN_TMUX_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
} from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_EXCLUDED_STATUS_NAMES: readonly string[] = [
  IN_TMUX_STATUS_NAME,
  IN_TMUX_BY_AGENT_STATUS_NAME,
];
export const DEFAULT_IDLE_THRESHOLD_SECONDS = 24 * 60 * 60;

type KillCandidate = {
  sessionName: string;
  reason: string;
};

export class StaleTmuxSessionKillUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'getAllOpened' | 'get'
    >,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      | 'listLiveSessionsWithActivity'
      | 'killSession'
      | 'listSessionNamesForIssueUrl'
    >,
  ) {}

  run = async (params: {
    project: Project;
    excludedStatusNames: readonly string[];
    idleThresholdSeconds: number;
    now: Date;
  }): Promise<void> => {
    const liveSessions =
      await this.tmuxSessionRepository.listLiveSessionsWithActivity();
    const openIssues = await this.issueRepository.getAllOpened(params.project);
    const issueBySessionName = new Map<string, Issue>();
    const protectedSessionNames = new Set<string>();
    const failures: unknown[] = [];
    for (const issue of openIssues) {
      let sessionNames = [toTmuxSessionName(issue.url)];
      try {
        sessionNames = [
          ...new Set([
            ...sessionNames,
            ...(await this.tmuxSessionRepository.listSessionNamesForIssueUrl(
              issue.url,
            )),
          ]),
        ];
        const liveIssue = await this.issueRepository.get(
          issue.url,
          params.project,
        );
        if (liveIssue !== null) {
          for (const sessionName of sessionNames) {
            issueBySessionName.set(sessionName, liveIssue);
          }
        } else {
          for (const sessionName of sessionNames)
            protectedSessionNames.add(sessionName);
        }
      } catch (error) {
        console.error(
          `Failed to read live session mapping for ${issue.url}`,
          error,
        );
        failures.push(error);
        for (const sessionName of sessionNames)
          protectedSessionNames.add(sessionName);
      }
    }

    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const killCandidates: KillCandidate[] = [];
    for (const session of liveSessions) {
      if (
        protectedSessionNames.has(session.sessionName) ||
        (failures.length > 0 && !issueBySessionName.has(session.sessionName))
      )
        continue;
      const reason = this.evaluateKillReason(
        session,
        issueBySessionName.get(session.sessionName) ?? null,
        nowEpochSeconds,
        params.excludedStatusNames,
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
      try {
        await this.tmuxSessionRepository.killSession(candidate.sessionName);
        console.log(
          `Killed tmux session: ${candidate.sessionName} (${candidate.reason})`,
        );
      } catch (error) {
        console.error(
          `Failed to kill tmux session ${candidate.sessionName}`,
          error,
        );
        failures.push(error);
      }
    }
    if (failures.length > 0) throw new Error(failures.map(String).join('; '));
  };

  private evaluateKillReason = (
    session: LiveTmuxSession,
    issue: Issue | null,
    nowEpochSeconds: number,
    excludedStatusNames: readonly string[],
    idleThresholdSeconds: number,
  ): string | null => {
    if (issue !== null) {
      if (issueSessionIsOnHold(issue))
        return `mapped to held issue ${issue.url}`;
      const isExcludedStatus =
        issue.status !== null && excludedStatusNames.includes(issue.status);
      if (isExcludedStatus) {
        return null;
      }

      const idleSeconds = nowEpochSeconds - session.activityEpochSeconds;
      if (idleSeconds >= idleThresholdSeconds) {
        return `mapped to open issue ${issue.url} with status "${issue.status ?? 'null'}" which is not an excluded status and has been idle for ${idleSeconds} seconds (threshold ${idleThresholdSeconds} seconds)`;
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
