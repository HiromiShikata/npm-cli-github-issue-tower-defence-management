import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_MONITORED_STATUS = IN_TMUX_STATUS_NAME;
export const DEFAULT_SILENT_THRESHOLD_SECONDS = 10 * 60;
export const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 30 * 60;

export const SELF_CHECK_NOTIFICATION_MESSAGE = [
  'No output for a while. Please run the following three self-checks.',
  '1. Re-check that every request you received is tracked as a session task and that your plan is the fastest possible (parallelize independent work, delegate, and remove needless serialization).',
  '2. Confirm a monitor is in place that detects when a subprocess or subtask produces no output for 5 minutes.',
  '3. Confirm whether a call to the owner (a confirmation, question, or decision request) is needed but not yet made, and make it if so.',
].join('\n');

type NotifyCandidate = {
  sessionName: string;
  silentSeconds: number;
};

export class NotifySilentLiveSessionsUseCase {
  constructor(
    private readonly issueRepository: Pick<IssueRepository, 'getAllOpened'>,
    private readonly tmuxSessionRepository: Pick<
      TmuxSessionRepository,
      'listLiveSessionNames'
    >,
    private readonly sessionOutputActivityRepository: SessionOutputActivityRepository,
    private readonly notificationRepository: SilentSessionNotificationRepository,
  ) {}

  run = async (params: {
    project: Project;
    allowCacheMinutes: number;
    monitoredStatus: string;
    silentThresholdSeconds: number;
    cooldownSeconds: number;
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

    const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
    const candidates: NotifyCandidate[] = [];
    for (const sessionName of monitoredSessionNames) {
      const lastOutputEpochSeconds = lastOutputBySessionName.get(sessionName);
      if (lastOutputEpochSeconds === undefined) {
        continue;
      }
      const silentSeconds = nowEpochSeconds - lastOutputEpochSeconds;
      if (silentSeconds >= params.silentThresholdSeconds) {
        candidates.push({ sessionName, silentSeconds });
      }
    }

    console.log(
      `Silent live session notification: ${candidates.length} candidate(s) of ${monitoredSessionNames.length} monitored session(s).`,
    );

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
      await this.notificationRepository.sendSelfCheckNotification(
        candidate.sessionName,
        SELF_CHECK_NOTIFICATION_MESSAGE,
      );
      await this.notificationRepository.setLastNotifiedEpochSeconds(
        candidate.sessionName,
        nowEpochSeconds,
      );
      console.log(
        `Notified ${candidate.sessionName}: silent for ${candidate.silentSeconds} seconds (threshold ${params.silentThresholdSeconds} seconds).`,
      );
    }
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
