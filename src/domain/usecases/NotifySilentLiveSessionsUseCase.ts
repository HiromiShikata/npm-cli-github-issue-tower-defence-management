import { LiveSessionActivitySnapshot } from '../entities/LiveSessionActivitySnapshot';
import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';
import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';

export const DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
export const DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
export const DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
export const DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;

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
    private readonly messageComposer: SilentSessionMessageComposer,
    private readonly sleeper: Sleeper,
    private readonly hubTaskStatusResolver: HubTaskStatusResolver | null = null,
  ) {}

  run = async (params: {
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    staggerSeconds: number;
    activeHubTaskStatus: string | null;
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

    const snapshots = await this.collectSnapshots(
      interactiveSessions,
      transcriptPathBySessionName,
      params.now,
    );

    const candidates: NotifyCandidate[] = [];
    for (const sessionSnapshot of snapshots) {
      const message = this.composeMessage(sessionSnapshot, params);
      if (message !== null) {
        candidates.push({ sessionName: sessionSnapshot.sessionName, message });
      }
    }
    candidates.sort((left, right) =>
      left.sessionName < right.sessionName
        ? -1
        : left.sessionName > right.sessionName
          ? 1
          : 0,
    );

    console.log(
      `Silent live session notification: ${candidates.length} candidate(s) of ${interactiveSessions.length} interactive session(s).`,
    );

    let sentCount = 0;
    for (const candidate of candidates) {
      if (
        !(await this.isHubTaskActive(
          candidate.sessionName,
          params.activeHubTaskStatus,
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
    }
  };

  private isHubTaskActive = async (
    sessionName: string,
    activeHubTaskStatus: string | null,
  ): Promise<boolean> => {
    if (activeHubTaskStatus === null || this.hubTaskStatusResolver === null) {
      return true;
    }
    const hubTaskIssueUrl = parseHubTaskIssueUrlFromSessionName(sessionName);
    if (hubTaskIssueUrl === null) {
      return true;
    }
    try {
      const issue =
        await this.hubTaskStatusResolver.getIssueByUrl(hubTaskIssueUrl);
      if (issue === null) {
        console.log(
          `Hub task ${hubTaskIssueUrl} for session ${sessionName} is not a resolvable tracked task; sending notification (fail-open).`,
        );
        return true;
      }
      if (issue.state !== 'OPEN' || issue.status !== activeHubTaskStatus) {
        console.log(
          `Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active (state "${issue.state}", status "${issue.status ?? 'null'}", active status "${activeHubTaskStatus}").`,
        );
        return false;
      }
      return true;
    } catch (error) {
      console.warn(
        `Failed to resolve hub task status for session ${sessionName} (${hubTaskIssueUrl}); sending notification (fail-open): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return true;
    }
  };

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

    const sessionNamesWithUnansweredOwnerCall =
      await this.ownerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall(
        transcriptPathBySessionName,
      );

    const nowEpochSeconds = Math.floor(now.getTime() / 1000);
    return sessionNames.map((sessionName) => {
      const lastOutputEpochSeconds = lastOutputBySessionName.get(sessionName);
      const mainSilentSeconds =
        lastOutputEpochSeconds === undefined
          ? null
          : nowEpochSeconds - lastOutputEpochSeconds;
      return {
        sessionName,
        mainSilentSeconds,
        subAgents: subAgentsBySessionName.get(sessionName) ?? [],
        hasUnansweredOwnerCall:
          sessionNamesWithUnansweredOwnerCall.has(sessionName),
      };
    });
  };

  private composeMessage = (
    snapshot: LiveSessionActivitySnapshot,
    thresholds: {
      mainSilentThresholdSeconds: number;
      subAgentSilentThresholdSeconds: number;
      subAgentRunningThresholdSeconds: number;
    },
  ): string | null => {
    const sections: string[] = [];

    if (
      snapshot.mainSilentSeconds !== null &&
      snapshot.mainSilentSeconds >= thresholds.mainSilentThresholdSeconds &&
      !snapshot.hasUnansweredOwnerCall
    ) {
      sections.push(
        this.messageComposer.composeMainStalledSection(
          snapshot.mainSilentSeconds,
        ),
      );
    }

    const stalledSubAgents = snapshot.subAgents.filter(
      (subAgent) =>
        subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds ||
        subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds,
    );
    if (stalledSubAgents.length > 0) {
      sections.push(
        this.messageComposer.composeSubAgentSection(stalledSubAgents),
      );
    }

    if (sections.length === 0) {
      return null;
    }
    return sections.join('\n\n');
  };
}
