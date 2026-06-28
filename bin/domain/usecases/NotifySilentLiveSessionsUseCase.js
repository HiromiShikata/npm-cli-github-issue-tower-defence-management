"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifySilentLiveSessionsUseCase = exports.parseHubTaskIssueUrlFromSessionName = exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = exports.DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = void 0;
const ResolveInteractiveLiveSessionsUseCase_1 = require("./ResolveInteractiveLiveSessionsUseCase");
exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
exports.DEFAULT_NOTIFICATION_COOLDOWN_SECONDS = 30 * 60;
exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
const GITHUB_ISSUE_URL_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/;
const parseHubTaskIssueUrlFromSessionName = (sessionName) => {
    return GITHUB_ISSUE_URL_PATTERN.test(sessionName) ? sessionName : null;
};
exports.parseHubTaskIssueUrlFromSessionName = parseHubTaskIssueUrlFromSessionName;
class NotifySilentLiveSessionsUseCase {
    constructor(liveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver, sessionOutputActivityRepository, subAgentActivityRepository, ownerCallStatusProvider, notificationRepository, messageComposer, sleeper, hubTaskStatusResolver = null) {
        this.liveSessionProcessSnapshotProvider = liveSessionProcessSnapshotProvider;
        this.interactiveLiveSessionTranscriptResolver = interactiveLiveSessionTranscriptResolver;
        this.sessionOutputActivityRepository = sessionOutputActivityRepository;
        this.subAgentActivityRepository = subAgentActivityRepository;
        this.ownerCallStatusProvider = ownerCallStatusProvider;
        this.notificationRepository = notificationRepository;
        this.messageComposer = messageComposer;
        this.sleeper = sleeper;
        this.hubTaskStatusResolver = hubTaskStatusResolver;
        this.resolveInteractiveLiveSessions = new ResolveInteractiveLiveSessionsUseCase_1.ResolveInteractiveLiveSessionsUseCase();
        this.run = async (params) => {
            const snapshot = await this.liveSessionProcessSnapshotProvider.getSnapshot();
            const interactiveSessions = this.resolveInteractiveLiveSessions.resolve(snapshot);
            const transcriptPathBySessionName = this.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(interactiveSessions);
            const snapshots = await this.collectSnapshots(interactiveSessions, transcriptPathBySessionName, params.now);
            const candidates = [];
            for (const sessionSnapshot of snapshots) {
                const message = this.composeMessage(sessionSnapshot, params);
                if (message !== null) {
                    candidates.push({ sessionName: sessionSnapshot.sessionName, message });
                }
            }
            candidates.sort((left, right) => left.sessionName < right.sessionName
                ? -1
                : left.sessionName > right.sessionName
                    ? 1
                    : 0);
            console.log(`Silent live session notification: ${candidates.length} candidate(s) of ${interactiveSessions.length} interactive session(s).`);
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            let sentCount = 0;
            for (const candidate of candidates) {
                const lastNotifiedEpochSeconds = await this.notificationRepository.getLastNotifiedEpochSeconds(candidate.sessionName);
                if (lastNotifiedEpochSeconds !== null &&
                    nowEpochSeconds - lastNotifiedEpochSeconds < params.cooldownSeconds) {
                    console.log(`Skipping ${candidate.sessionName}: notified ${nowEpochSeconds - lastNotifiedEpochSeconds} seconds ago, within cooldown ${params.cooldownSeconds} seconds.`);
                    continue;
                }
                if (!(await this.isHubTaskActive(candidate.sessionName, params.activeHubTaskStatus))) {
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
        this.isHubTaskActive = async (sessionName, activeHubTaskStatus) => {
            if (activeHubTaskStatus === null || this.hubTaskStatusResolver === null) {
                return true;
            }
            const hubTaskIssueUrl = (0, exports.parseHubTaskIssueUrlFromSessionName)(sessionName);
            if (hubTaskIssueUrl === null) {
                return true;
            }
            try {
                const issue = await this.hubTaskStatusResolver.getIssueByUrl(hubTaskIssueUrl);
                if (issue === null) {
                    console.warn(`Hub task ${hubTaskIssueUrl} for session ${sessionName} could not be resolved; sending notification (fail-open).`);
                    return true;
                }
                if (issue.state !== 'OPEN' || issue.status !== activeHubTaskStatus) {
                    console.log(`Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active (state "${issue.state}", status "${issue.status ?? 'null'}", active status "${activeHubTaskStatus}").`);
                    return false;
                }
                return true;
            }
            catch (error) {
                console.warn(`Failed to resolve hub task status for session ${sessionName} (${hubTaskIssueUrl}); sending notification (fail-open): ${error instanceof Error ? error.message : String(error)}`);
                return true;
            }
        };
        this.collectSnapshots = async (interactiveSessions, transcriptPathBySessionName, now) => {
            const sessionNames = interactiveSessions.map((session) => session.sessionName);
            const activities = await this.sessionOutputActivityRepository.listSessionOutputActivities(transcriptPathBySessionName);
            const lastOutputBySessionName = new Map();
            for (const activity of activities) {
                lastOutputBySessionName.set(activity.sessionName, activity.lastOutputEpochSeconds);
            }
            const subAgentsBySessionName = await this.subAgentActivityRepository.listSubAgentActivitiesBySessionName(sessionNames);
            const sessionNamesWithUnansweredOwnerCall = await this.ownerCallStatusProvider.listSessionNamesWithUnansweredOwnerCall(transcriptPathBySessionName);
            const nowEpochSeconds = Math.floor(now.getTime() / 1000);
            return sessionNames.map((sessionName) => {
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
    }
}
exports.NotifySilentLiveSessionsUseCase = NotifySilentLiveSessionsUseCase;
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.js.map