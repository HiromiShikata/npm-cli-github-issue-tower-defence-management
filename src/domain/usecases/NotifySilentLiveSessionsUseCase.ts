import { LiveSessionActivitySnapshot } from '../entities/LiveSessionActivitySnapshot';
import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';
import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { RefusalTailStatusProvider } from './adapter-interfaces/RefusalTailStatusProvider';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { SilentSessionCandidateStateRepository } from './adapter-interfaces/SilentSessionCandidateStateRepository';
import { SilentSessionHubTaskStatusCacheRepository } from './adapter-interfaces/SilentSessionHubTaskStatusCacheRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';

export const DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
// Retained only for backward compatibility of the configuration surface
// (TDPM_SILENT_UNANSWERED_OWNER_CALL_GRACE_SECONDS). The value is no longer
// consulted: an unanswered owner call suppresses the main-stall reminder
// unconditionally (treated as an infinite grace). See composeCandidate.
export const DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS = 60 * 60;
export const DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
export const DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
export const DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
export const DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS = 15 * 60;
export const DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS = 5 * 60;

const GITHUB_ISSUE_OR_PULL_URL_PATTERN =
  /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/;

const GITHUB_TMUX_SESSION_NAME_PATTERN =
  /^https_\/\/github_com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/;

export const parseHubTaskIssueUrlFromSessionName = (
  sessionName: string,
): string | null => {
  if (GITHUB_ISSUE_OR_PULL_URL_PATTERN.test(sessionName)) {
    return sessionName;
  }
  const tmuxMatch = GITHUB_TMUX_SESSION_NAME_PATTERN.exec(sessionName);
  if (tmuxMatch === null) {
    return null;
  }
  const [, owner, repo, number] = tmuxMatch;
  const target = sessionName.includes('/pull/') ? 'pull' : 'issues';
  return `https://github.com/${owner}/${repo}/${target}/${number}`;
};

const GITHUB_ISSUE_OR_PULL_REQUEST_SESSION_NAME_PATTERN =
  /^https(:\/\/|_\/\/)github(\.com|_com)\/[^/]+\/[^/]+\/(issues|pull)\/\d+$/;

export const isGitHubIssueOrPullRequestSessionName = (
  sessionName: string,
): boolean =>
  GITHUB_ISSUE_OR_PULL_REQUEST_SESSION_NAME_PATTERN.test(sessionName);

export type HubTaskStatusResolver = Pick<IssueRepository, 'getIssueByUrl'>;

type NotifyCandidate = {
  sessionName: string;
  message: string;
  newlyAnnouncedRunningLabels: string[];
  retainedAnnouncedRunningLabels: string[];
};

export class NotifySilentLiveSessionsUseCase {
  private readonly resolveInteractiveLiveSessions =
    new ResolveInteractiveLiveSessionsUseCase();

  constructor(
    private readonly liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider,
    private readonly interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver,
    private readonly sessionOutputActivityRepository: SessionOutputActivityRepository,
    private readonly subAgentActivityRepository: SessionSubAgentActivityRepository,
    private readonly ownerCallStatusProvider: OwnerCallStatusProvider,
    private readonly notificationRepository: SilentSessionNotificationRepository,
    private readonly candidateStateRepository: SilentSessionCandidateStateRepository,
    private readonly messageComposer: SilentSessionMessageComposer,
    private readonly sleeper: Sleeper,
    private readonly hubTaskStatusResolver: HubTaskStatusResolver | null = null,
    private readonly hubTaskStatusCacheRepository: SilentSessionHubTaskStatusCacheRepository | null = null,
    private readonly refusalTailStatusProvider: RefusalTailStatusProvider | null = null,
  ) {}

  run = async (params: {
    mainSilentThresholdSeconds: number;
    unansweredOwnerCallGraceSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    staggerSeconds: number;
    candidateDebounceRecencyWindowSeconds: number;
    activeHubTaskStatus: string | null;
    hubTaskStatusCacheTtlSeconds: number;
    now: Date;
  }): Promise<void> => {
    const snapshot =
      await this.liveSessionProcessSnapshotProvider.getSnapshot();
    const allInteractiveSessions =
      this.resolveInteractiveLiveSessions.resolve(snapshot);
    const interactiveSessions = allInteractiveSessions.filter((session) =>
      isGitHubIssueOrPullRequestSessionName(session.sessionName),
    );
    const skippedNonGitHubSessionCount =
      allInteractiveSessions.length - interactiveSessions.length;
    if (skippedNonGitHubSessionCount > 0) {
      console.log(
        `Silent live session notification: ignoring ${skippedNonGitHubSessionCount} non-github-named interactive session(s); only sessions named after a github.com issue or pull-request URL are monitored.`,
      );
    }
    const transcriptPathBySessionName =
      this.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(
        interactiveSessions,
      );

    // A session whose most recent assistant turn is a model refusal is
    // excluded from ALL reminder candidates (main-stall and sub-agent
    // branches alike): each reminder delivery re-sends the full session
    // context to the API and is guaranteed to produce another refusal, so
    // reminding such a session only burns tokens. The gate is state-based
    // (no time windows) and self-clears once a non-refusal assistant turn
    // appears after the refusal.
    const refusalTailedSessionNames =
      this.refusalTailStatusProvider === null
        ? new Set<string>()
        : await this.refusalTailStatusProvider.listRefusalTailedSessionNames(
            transcriptPathBySessionName,
          );
    const monitoredSessions = interactiveSessions.filter((session) => {
      if (!refusalTailedSessionNames.has(session.sessionName)) {
        return true;
      }
      console.log(
        `Skipping ${session.sessionName}: last assistant turn was a model refusal; suppressing reminders until a non-refusal turn appears.`,
      );
      return false;
    });

    const snapshots = await this.collectSnapshots(
      monitoredSessions,
      transcriptPathBySessionName,
      params.now,
    );

    const candidates: NotifyCandidate[] = [];
    for (const sessionSnapshot of snapshots) {
      const candidate = await this.composeCandidate(sessionSnapshot, params);
      if (candidate !== null) {
        candidates.push(candidate);
      }
    }
    candidates.sort((left, right) =>
      left.sessionName < right.sessionName
        ? -1
        : left.sessionName > right.sessionName
          ? 1
          : 0,
    );

    const previousCandidateSessionNames =
      await this.candidateStateRepository.loadRecentCandidateSessionNames({
        now: params.now,
        recencyWindowSeconds: params.candidateDebounceRecencyWindowSeconds,
      });
    await this.candidateStateRepository.saveCandidateSessionNames({
      sessionNames: candidates.map((candidate) => candidate.sessionName),
      now: params.now,
    });

    const debouncedCandidates = candidates.filter((candidate) =>
      previousCandidateSessionNames.has(candidate.sessionName),
    );
    const suppressedFirstCycleCount =
      candidates.length - debouncedCandidates.length;

    console.log(
      `Silent live session notification: ${debouncedCandidates.length} debounced candidate(s) of ${candidates.length} current candidate(s) across ${interactiveSessions.length} interactive session(s); ${suppressedFirstCycleCount} first-cycle candidate(s) deferred until they persist into the next cycle.`,
    );

    let sentCount = 0;
    for (const candidate of debouncedCandidates) {
      if (
        !(await this.isHubTaskActive(
          candidate.sessionName,
          params.activeHubTaskStatus,
          params.hubTaskStatusCacheTtlSeconds,
          params.now,
        ))
      ) {
        continue;
      }
      if (sentCount > 0) {
        await this.sleeper.sleep(params.staggerSeconds * 1000);
      }
      await this.notificationRepository.sendSelfCheckNotification(
        candidate.sessionName,
        candidate.message,
      );
      sentCount += 1;
      console.log(`Notified ${candidate.sessionName}.`);
      if (candidate.newlyAnnouncedRunningLabels.length > 0) {
        await this.candidateStateRepository.saveAnnouncedRunningSubAgentLabels({
          sessionName: candidate.sessionName,
          labels: [
            ...candidate.retainedAnnouncedRunningLabels,
            ...candidate.newlyAnnouncedRunningLabels,
          ],
          now: params.now,
        });
      }
    }
  };

  private isHubTaskActive = async (
    sessionName: string,
    activeHubTaskStatus: string | null,
    hubTaskStatusCacheTtlSeconds: number,
    now: Date,
  ): Promise<boolean> => {
    if (activeHubTaskStatus === null || this.hubTaskStatusResolver === null) {
      return true;
    }
    const hubTaskIssueUrl = parseHubTaskIssueUrlFromSessionName(sessionName);
    if (hubTaskIssueUrl === null) {
      return true;
    }

    const cachedEntry =
      this.hubTaskStatusCacheRepository === null
        ? null
        : await this.hubTaskStatusCacheRepository.loadHubTaskStatus({
            url: hubTaskIssueUrl,
          });
    const nowEpochSeconds = Math.floor(now.getTime() / 1000);
    if (cachedEntry !== null) {
      const cacheAgeSeconds =
        nowEpochSeconds - cachedEntry.recordedEpochSeconds;
      if (cacheAgeSeconds <= hubTaskStatusCacheTtlSeconds) {
        const active = this.isResolvedStatusActive(
          cachedEntry.state,
          cachedEntry.status,
          activeHubTaskStatus,
        );
        if (!active) {
          console.log(
            `Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active per cached status (state "${cachedEntry.state}", status "${cachedEntry.status ?? 'null'}", active status "${activeHubTaskStatus}").`,
          );
        }
        return active;
      }
    }

    const resolution = await this.tryResolveAndCacheHubTask(
      hubTaskIssueUrl,
      activeHubTaskStatus,
      sessionName,
      now,
    );
    if (resolution.resolved) {
      return resolution.active;
    }

    if (cachedEntry !== null) {
      const active = this.isResolvedStatusActive(
        cachedEntry.state,
        cachedEntry.status,
        activeHubTaskStatus,
      );
      console.warn(
        `Hub task ${hubTaskIssueUrl} for session ${sessionName} could not be resolved (${resolution.reason}); falling back to expired cached status (state "${cachedEntry.state}", status "${cachedEntry.status ?? 'null'}"), so the notification is ${active ? 'sent' : 'suppressed'}.`,
      );
      return active;
    }

    console.warn(
      `Hub task ${hubTaskIssueUrl} for session ${sessionName} is not resolvable and has no cached status (${resolution.reason}); sending notification (fail-open).`,
    );
    return true;
  };

  private tryResolveAndCacheHubTask = async (
    hubTaskIssueUrl: string,
    activeHubTaskStatus: string,
    sessionName: string,
    now: Date,
  ): Promise<
    { resolved: true; active: boolean } | { resolved: false; reason: string }
  > => {
    if (this.hubTaskStatusResolver === null) {
      return { resolved: false, reason: 'resolver is not configured' };
    }
    let issue: Awaited<ReturnType<HubTaskStatusResolver['getIssueByUrl']>>;
    try {
      issue = await this.hubTaskStatusResolver.getIssueByUrl(hubTaskIssueUrl);
    } catch (error) {
      return {
        resolved: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    if (issue === null) {
      return { resolved: false, reason: 'resolver returned no tracked task' };
    }
    if (this.hubTaskStatusCacheRepository !== null) {
      await this.hubTaskStatusCacheRepository.saveHubTaskStatus({
        url: hubTaskIssueUrl,
        state: issue.state,
        status: issue.status,
        now,
      });
    }
    const active = this.isResolvedStatusActive(
      issue.state,
      issue.status,
      activeHubTaskStatus,
    );
    if (!active) {
      console.log(
        `Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active (state "${issue.state}", status "${issue.status ?? 'null'}", active status "${activeHubTaskStatus}").`,
      );
    }
    return { resolved: true, active };
  };

  private isResolvedStatusActive = (
    state: 'OPEN' | 'CLOSED' | 'MERGED',
    status: string | null,
    activeHubTaskStatus: string,
  ): boolean => state === 'OPEN' && status === activeHubTaskStatus;

  private collectSnapshots = async (
    interactiveSessions: InteractiveLiveSession[],
    transcriptPathBySessionName: Map<string, string>,
    now: Date,
  ): Promise<LiveSessionActivitySnapshot[]> => {
    const sessionNames = interactiveSessions.map(
      (session) => session.sessionName,
    );

    const activities =
      await this.sessionOutputActivityRepository.listSessionOutputActivities(
        transcriptPathBySessionName,
      );
    const lastOutputBySessionName = new Map<string, number>();
    for (const activity of activities) {
      lastOutputBySessionName.set(
        activity.sessionName,
        activity.lastOutputEpochSeconds,
      );
    }

    const subAgentsBySessionName =
      await this.subAgentActivityRepository.listSubAgentActivitiesBySessionName(
        sessionNames,
        transcriptPathBySessionName,
      );

    const unansweredOwnerCallEpochSecondsBySessionName =
      await this.ownerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName(
        transcriptPathBySessionName,
      );

    const nowEpochSeconds = Math.floor(now.getTime() / 1000);
    return sessionNames.map((sessionName) => {
      const lastOutputEpochSeconds = lastOutputBySessionName.get(sessionName);
      const mainSilentSeconds =
        lastOutputEpochSeconds === undefined
          ? null
          : nowEpochSeconds - lastOutputEpochSeconds;
      const unansweredOwnerCallEpochSeconds =
        unansweredOwnerCallEpochSecondsBySessionName.get(sessionName);
      return {
        sessionName,
        mainSilentSeconds,
        subAgents: subAgentsBySessionName.get(sessionName) ?? [],
        unansweredOwnerCallAgeSeconds:
          unansweredOwnerCallEpochSeconds === undefined
            ? null
            : nowEpochSeconds - unansweredOwnerCallEpochSeconds,
      };
    });
  };

  private composeCandidate = async (
    snapshot: LiveSessionActivitySnapshot,
    thresholds: {
      mainSilentThresholdSeconds: number;
      unansweredOwnerCallGraceSeconds: number;
      subAgentSilentThresholdSeconds: number;
      subAgentRunningThresholdSeconds: number;
      now: Date;
    },
  ): Promise<NotifyCandidate | null> => {
    const sections: string[] = [];

    const mainSilentSeconds = snapshot.mainSilentSeconds;
    const unansweredOwnerCallAgeSeconds =
      snapshot.unansweredOwnerCallAgeSeconds;
    // Owner-defined rule: whenever the latest owner call is newer than the
    // latest owner reply (i.e. the call is unanswered), the session is
    // waiting on the owner and MUST NOT receive a main-stall reminder —
    // unconditionally, with no age or grace expiry. The persistent unread
    // indicator in the owner's app covers the missed-call case, so a
    // time-based re-fire is unnecessary. `unansweredOwnerCallGraceSeconds`
    // is retained in the parameters only for backward compatibility of the
    // call signature and is intentionally ignored (treated as infinite).
    const suppressedByUnansweredOwnerCall =
      unansweredOwnerCallAgeSeconds !== null;
    const mainTriggered =
      mainSilentSeconds !== null &&
      mainSilentSeconds >= thresholds.mainSilentThresholdSeconds &&
      !suppressedByUnansweredOwnerCall;
    if (mainTriggered) {
      sections.push(
        this.messageComposer.composeMainStalledSection(mainSilentSeconds),
      );
    }

    const idleSubAgents = snapshot.subAgents.filter(
      (subAgent) =>
        !subAgent.waitingOnExternalProcess &&
        subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds,
    );
    const longRunningSubAgents = snapshot.subAgents.filter(
      (subAgent) =>
        subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds,
    );
    const retainedAnnouncedRunningLabels =
      await this.reconcileAnnouncedRunningLabels(snapshot, thresholds.now);
    const newlyLongRunningSubAgents = longRunningSubAgents.filter(
      (subAgent) => !retainedAnnouncedRunningLabels.includes(subAgent.label),
    );
    if (idleSubAgents.length > 0 || newlyLongRunningSubAgents.length > 0) {
      sections.push(
        this.messageComposer.composeSubAgentSection({
          idleSubAgents,
          longRunningSubAgents: newlyLongRunningSubAgents,
        }),
      );
    }

    if (sections.length === 0) {
      return null;
    }
    return {
      sessionName: snapshot.sessionName,
      message: sections.join('\n\n'),
      newlyAnnouncedRunningLabels: newlyLongRunningSubAgents.map(
        (subAgent) => subAgent.label,
      ),
      retainedAnnouncedRunningLabels,
    };
  };

  private reconcileAnnouncedRunningLabels = async (
    snapshot: LiveSessionActivitySnapshot,
    now: Date,
  ): Promise<string[]> => {
    const announcedLabels =
      await this.candidateStateRepository.loadAnnouncedRunningSubAgentLabels({
        sessionName: snapshot.sessionName,
      });
    const currentLabels = new Set(
      snapshot.subAgents.map((subAgent) => subAgent.label),
    );
    const retainedLabels = Array.from(announcedLabels).filter((label) =>
      currentLabels.has(label),
    );
    if (retainedLabels.length !== announcedLabels.size) {
      await this.candidateStateRepository.saveAnnouncedRunningSubAgentLabels({
        sessionName: snapshot.sessionName,
        labels: retainedLabels,
        now,
      });
    }
    return retainedLabels;
  };
}
