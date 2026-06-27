import { Issue } from '../entities/Issue';
import { LiveSessionActivitySnapshot } from '../entities/LiveSessionActivitySnapshot';
import { Project } from '../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_MONITORED_STATUS = IN_TMUX_STATUS_NAME;
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
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'getAllOpened'>,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listLiveSessionNames'
    >,
    private readonly sessionOutputActivityRepository: SessionOutputActivityRepository,
    private readonly subAgentActivityRepository: SessionSubAgentActivityRepository,
    private readonly ownerCallStatusProvider: OwnerCallStatusProvider,
    private readonly notificationRepository: SilentSessionNotificationRepository,
    private readonly messageComposer: SilentSessionMessageComposer,
    private readonly sleeper: Sleeper,
  ) {}

  run = async (params: {
    project: Project;
    allowCacheMinutes: number;
    monitoredStatus: string;
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
    now: Date;
  }): Promise<void> => {
    const liveSessionNames = new Set(
      await this.tmuxSessionRepository.listLiveSessionNames(),
    );
    const openIssues = await this.issueRepository.getAllOpened(
      params.project,
      params.allowCacheMinutes,
    );
    const monitoredSessionNames = this.selectMonitoredSessionNames(
      openIssues,
      liveSessionNames,
      params.monitoredStatus,
    );

    const snapshots = await this.collectSnapshots(
      monitoredSessionNames,
      params.now,
    );

    const candidates: NotifyCandidate[] = [];
    for (const snapshot of snapshots) {
      const message = this.composeMessage(snapshot, params);
      if (message !== null) {
        candidates.push({ sessionName: snapshot.sessionName, message });
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
      `Silent live session notification: ${candidates.length} candidate(s) of ${monitoredSessionNames.length} monitored session(s).`,
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
    monitoredSessionNames: string[],
    now: Date,
  ): Promise<LiveSessionActivitySnapshot[]> => {
    const activities =
      await this.sessionOutputActivityRepository.listSessionOutputActivities(
        monitoredSessionNames,
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
        monitoredSessionNames,
      );

    const sessionNamesWithUnansweredOwnerCall =
      await this.ownerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall(
        monitoredSessionNames,
      );

    const nowEpochSeconds = Math.floor(now.getTime() / 1000);
    return monitoredSessionNames.map((sessionName) => {
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

  private selectMonitoredSessionNames = (
    openIssues: Issue[],
    liveSessionNames: Set<string>,
    monitoredStatus: string,
  ): string[] => {
    const monitoredSessionNames: string[] = [];
    for (const issue of openIssues) {
      if (issue.status !== monitoredStatus) {
        continue;
      }
      const sessionName = toTmuxSessionName(issue.url);
      if (liveSessionNames.has(sessionName)) {
        monitoredSessionNames.push(sessionName);
      }
    }
    return monitoredSessionNames;
  };
}
