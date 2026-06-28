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
import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';

export const DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
export const DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
export const DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
export const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 30 * 60;
export const DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;

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
  ) {}

  run = async (params: {
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
    now: Date;
  }): Promise<void> => {
    const snapshot =
      await this.liveSessionProcessSnapshotProvider.getSnapshot();
    const interactiveSessions =
      this.resolveInteractiveLiveSessions.resolve(snapshot);
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

    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    let sentCount = 0;
    for (const candidate of candidates) {
      const lastNotifiedEpochSeconds =
        await this.notificationRepository.getLastNotifiedEpochSeconds(
          candidate.sessionName,
        );
      if (
        lastNotifiedEpochSeconds !== null &&
        nowEpochSeconds - lastNotifiedEpochSeconds < params.cooldownSeconds
      ) {
        console.log(
          `Skipping ${candidate.sessionName}: notified ${
            nowEpochSeconds - lastNotifiedEpochSeconds
          } seconds ago, within cooldown ${params.cooldownSeconds} seconds.`,
        );
        continue;
      }
      if (sentCount > 0) {
        await this.sleeper.sleep(params.staggerSeconds * 1000);
      }
      await this.notificationRepository.sendSelfCheckNotification(
        candidate.sessionName,
        candidate.message,
      );
      await this.notificationRepository.setLastNotifiedEpochSeconds(
        candidate.sessionName,
        nowEpochSeconds,
      );
      sentCount += 1;
      console.log(`Notified ${candidate.sessionName}.`);
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
      snapshot.mainSilentSeconds >= thresholds.mainSilentThresholdSeconds
    ) {
      if (snapshot.hasUnansweredOwnerCall) {
        // The session is correctly waiting on the owner, but it has been silent
        // long enough that the owner has effectively not been re-notified. Rather
        // than suppress, instruct the agent to re-raise its pending call-to-user
        // so the owner's marker re-fires. The per-session cooldown applied in
        // run() limits this to roughly once per cooldown window, and it stops
        // automatically once the owner replies (hasUnansweredOwnerCall clears).
        sections.push(
          this.messageComposer.composeOwnerReNotificationSection(
            snapshot.mainSilentSeconds,
          ),
        );
      } else {
        sections.push(
          this.messageComposer.composeMainStalledSection(
            snapshot.mainSilentSeconds,
          ),
        );
      }
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
