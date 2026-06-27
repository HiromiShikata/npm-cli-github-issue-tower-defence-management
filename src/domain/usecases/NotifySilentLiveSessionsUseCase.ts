import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IN_TMUX_STATUS_NAME } from '../entities/WorkflowStatus';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

export const DEFAULT_EXCLUDED_STATUS = IN_TMUX_STATUS_NAME;
export const DEFAULT_SILENT_THRESHOLD_SECONDS = 10 * 60;
export const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 30 * 60;

export const SELF_CHECK_NOTIFICATION_MESSAGE = [
  '出力が一定時間止まっています。次の3点を自己点検してください。',
  '1. オーナーから受けた依頼がすべてセッションのタスクとして登録されているか、そしてその進め方が最速になっているか（独立作業の並列化・委譲・不要な直列化の排除）を再点検する。',
  '2. 子プロセス・サブ作業が一定時間（5分）出力を出していないことを検知する監視が設定されているかを確認する。',
  '3. オーナーへの呼び出し（確認・質問・判断依頼）が必要なのに行えていない状態になっていないかを確認し、必要なら呼び出す。',
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
    excludedStatus: string;
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
      params.excludedStatus,
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
    excludedStatus: string,
  ): string[] => {
    const monitoredSessionNames: string[] = [];
    for (const issue of openIssues) {
      if (issue.status !== excludedStatus) {
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
