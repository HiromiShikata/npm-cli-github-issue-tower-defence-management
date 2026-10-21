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
    const issuesBySessionName = new Map<string, Issue[]>();
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
            issuesBySessionName.set(sessionName, [
              ...(issuesBySessionName.get(sessionName) ?? []),
              liveIssue,
            ]);
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
        (failures.length > 0 && !issuesBySessionName.has(session.sessionName))
      )
        continue;
      const reason = this.evaluateKillReason(
        session,
        issuesBySessionName.get(session.sessionName) ?? [],
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
    issues: readonly Issue[],
    nowEpochSeconds: number,
    excludedStatusNames: readonly string[],
    idleThresholdSeconds: number,
  ): string | null => {
    if (issues.length > 0) {
      const heldIssues = issues.filter((issue) => issueSessionIsOnHold(issue));
      if (heldIssues.length === issues.length)
        return `mapped to held issue ${heldIssues[0].url}`;
      if (heldIssues.length > 0) return null;
      const issue = issues[issues.length - 1];
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
