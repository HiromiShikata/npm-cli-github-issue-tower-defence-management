"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifySilentLiveSessionsUseCase = exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = exports.DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = exports.DEFAULT_MONITORED_STATUS = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const InTmuxByHumanSessionReconcileUseCase_1 = require("./intmux/InTmuxByHumanSessionReconcileUseCase");
exports.DEFAULT_MONITORED_STATUS = WorkflowStatus_1.IN_TMUX_STATUS_NAME;
exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
exports.DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 30 * 60;
exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
class NotifySilentLiveSessionsUseCase {
    constructor(issueRepository, tmuxSessionRepository, sessionOutputActivityRepository, subAgentActivityRepository, ownerCallStatusProvider, notificationRepository, messageComposer, sleeper) {
        this.issueRepository = issueRepository;
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.sessionOutputActivityRepository = sessionOutputActivityRepository;
        this.subAgentActivityRepository = subAgentActivityRepository;
        this.ownerCallStatusProvider = ownerCallStatusProvider;
        this.notificationRepository = notificationRepository;
        this.messageComposer = messageComposer;
        this.sleeper = sleeper;
        this.run = async (params) => {
            const liveSessionNames = new Set(await this.tmuxSessionRepository.listLiveSessionNames());
            const openIssues = await this.issueRepository.getAllOpened(params.project, params.allowCacheMinutes);
            const monitoredSessionNames = this.selectMonitoredSessionNames(openIssues, liveSessionNames, params.monitoredStatus);
            const snapshots = await this.collectSnapshots(monitoredSessionNames, params.now);
            const candidates = [];
            for (const snapshot of snapshots) {
                const message = this.composeMessage(snapshot, params);
                if (message !== null) {
                    candidates.push({ sessionName: snapshot.sessionName, message });
                }
            }
            candidates.sort((left, right) => left.sessionName < right.sessionName
                ? -1
                : left.sessionName > right.sessionName
                    ? 1
                    : 0);
            console.log(`Silent live session notification: ${candidates.length} candidate(s) of ${monitoredSessionNames.length} monitored session(s).`);
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            let sentCount = 0;
            for (const candidate of candidates) {
                const lastNotifiedEpochSeconds = await this.notificationRepository.getLastNotifiedEpochSeconds(candidate.sessionName);
                if (lastNotifiedEpochSeconds !== null &&
                    nowEpochSeconds - lastNotifiedEpochSeconds < params.cooldownSeconds) {
                    console.log(`Skipping ${candidate.sessionName}: notified ${nowEpochSeconds - lastNotifiedEpochSeconds} seconds ago, within cooldown ${params.cooldownSeconds} seconds.`);
                    continue;
                }
                if (sentCount > 0) {
                    await this.sleeper.sleep(params.staggerSeconds * 1000);
                }
                await this.notificationRepository.sendSelfCheckNotification(candidate.sessionName, candidate.message);
                await this.notificationRepository.setLastNotifiedEpochSeconds(candidate.sessionName, nowEpochSeconds);
                sentCount += 1;
                console.log(`Notified ${candidate.sessionName}.`);
            }
        };
        this.collectSnapshots = async (monitoredSessionNames, now) => {
            const activities = await this.sessionOutputActivityRepository.listSessionOutputActivities(monitoredSessionNames);
            const lastOutputBySessionName = new Map();
            for (const activity of activities) {
                lastOutputBySessionName.set(activity.sessionName, activity.lastOutputEpochSeconds);
            }
            const subAgentsBySessionName = await this.subAgentActivityRepository.listSubAgentActivitiesBySessionName(monitoredSessionNames);
            const sessionNamesWithUnansweredOwnerCall = await this.ownerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall(monitoredSessionNames);
            const nowEpochSeconds = Math.floor(now.getTime() / 1000);
            return monitoredSessionNames.map((sessionName) => {
                const lastOutputEpochSeconds = lastOutputBySessionName.get(sessionName);
                const mainSilentSeconds = lastOutputEpochSeconds === undefined
                    ? null
                    : nowEpochSeconds - lastOutputEpochSeconds;
                return {
                    sessionName,
                    mainSilentSeconds,
                    subAgents: subAgentsBySessionName.get(sessionName) ?? [],
                    hasUnansweredOwnerCall: sessionNamesWithUnansweredOwnerCall.has(sessionName),
                };
            });
        };
        this.composeMessage = (snapshot, thresholds) => {
            const sections = [];
            if (snapshot.mainSilentSeconds !== null &&
                snapshot.mainSilentSeconds >= thresholds.mainSilentThresholdSeconds &&
                !snapshot.hasUnansweredOwnerCall) {
                sections.push(this.messageComposer.composeMainStalledSection(snapshot.mainSilentSeconds));
            }
            const stalledSubAgents = snapshot.subAgents.filter((subAgent) => subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds ||
                subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds);
            if (stalledSubAgents.length > 0) {
                sections.push(this.messageComposer.composeSubAgentSection(stalledSubAgents));
            }
            if (sections.length === 0) {
                return null;
            }
            return sections.join('\n\n');
        };
        this.selectMonitoredSessionNames = (openIssues, liveSessionNames, monitoredStatus) => {
            const monitoredSessionNames = [];
            for (const issue of openIssues) {
                if (issue.status !== monitoredStatus) {
                    continue;
                }
                const sessionName = (0, InTmuxByHumanSessionReconcileUseCase_1.toTmuxSessionName)(issue.url);
                if (liveSessionNames.has(sessionName)) {
                    monitoredSessionNames.push(sessionName);
                }
            }
            return monitoredSessionNames;
        };
    }
}
exports.NotifySilentLiveSessionsUseCase = NotifySilentLiveSessionsUseCase;
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.js.map