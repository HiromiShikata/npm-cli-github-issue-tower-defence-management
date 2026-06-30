"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifySilentLiveSessionsUseCase = exports.isGitHubIssueOrPullRequestSessionName = exports.parseHubTaskIssueUrlFromSessionName = exports.DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS = exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = void 0;
const ResolveInteractiveLiveSessionsUseCase_1 = require("./ResolveInteractiveLiveSessionsUseCase");
exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
exports.DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS = 15 * 60;
const GITHUB_ISSUE_OR_PULL_URL_PATTERN = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/;
const GITHUB_TMUX_SESSION_NAME_PATTERN = /^https_\/\/github_com\/([^/]+)\/([^/]+)\/(?:issues|pull)\/(\d+)$/;
const parseHubTaskIssueUrlFromSessionName = (sessionName) => {
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
exports.parseHubTaskIssueUrlFromSessionName = parseHubTaskIssueUrlFromSessionName;
const GITHUB_ISSUE_OR_PULL_REQUEST_SESSION_NAME_PATTERN = /^https(:\/\/|_\/\/)github(\.com|_com)\/[^/]+\/[^/]+\/(issues|pull)\/\d+$/;
const isGitHubIssueOrPullRequestSessionName = (sessionName) => GITHUB_ISSUE_OR_PULL_REQUEST_SESSION_NAME_PATTERN.test(sessionName);
exports.isGitHubIssueOrPullRequestSessionName = isGitHubIssueOrPullRequestSessionName;
class NotifySilentLiveSessionsUseCase {
    constructor(liveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver, sessionOutputActivityRepository, subAgentActivityRepository, ownerCallStatusProvider, notificationRepository, candidateStateRepository, messageComposer, sleeper, hubTaskStatusResolver = null) {
        this.liveSessionProcessSnapshotProvider = liveSessionProcessSnapshotProvider;
        this.interactiveLiveSessionTranscriptResolver = interactiveLiveSessionTranscriptResolver;
        this.sessionOutputActivityRepository = sessionOutputActivityRepository;
        this.subAgentActivityRepository = subAgentActivityRepository;
        this.ownerCallStatusProvider = ownerCallStatusProvider;
        this.notificationRepository = notificationRepository;
        this.candidateStateRepository = candidateStateRepository;
        this.messageComposer = messageComposer;
        this.sleeper = sleeper;
        this.hubTaskStatusResolver = hubTaskStatusResolver;
        this.resolveInteractiveLiveSessions = new ResolveInteractiveLiveSessionsUseCase_1.ResolveInteractiveLiveSessionsUseCase();
        this.run = async (params) => {
            const snapshot = await this.liveSessionProcessSnapshotProvider.getSnapshot();
            const allInteractiveSessions = this.resolveInteractiveLiveSessions.resolve(snapshot);
            const interactiveSessions = allInteractiveSessions.filter((session) => (0, exports.isGitHubIssueOrPullRequestSessionName)(session.sessionName));
            const skippedNonGitHubSessionCount = allInteractiveSessions.length - interactiveSessions.length;
            if (skippedNonGitHubSessionCount > 0) {
                console.log(`Silent live session notification: ignoring ${skippedNonGitHubSessionCount} non-github-named interactive session(s); only sessions named after a github.com issue or pull-request URL are monitored.`);
            }
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
            const previousCandidateSessionNames = await this.candidateStateRepository.loadRecentCandidateSessionNames({
                now: params.now,
                recencyWindowSeconds: params.candidateDebounceRecencyWindowSeconds,
            });
            await this.candidateStateRepository.saveCandidateSessionNames({
                sessionNames: candidates.map((candidate) => candidate.sessionName),
                now: params.now,
            });
            const debouncedCandidates = candidates.filter((candidate) => previousCandidateSessionNames.has(candidate.sessionName));
            const suppressedFirstCycleCount = candidates.length - debouncedCandidates.length;
            console.log(`Silent live session notification: ${debouncedCandidates.length} debounced candidate(s) of ${candidates.length} current candidate(s) across ${interactiveSessions.length} interactive session(s); ${suppressedFirstCycleCount} first-cycle candidate(s) deferred until they persist into the next cycle.`);
            let sentCount = 0;
            for (const candidate of debouncedCandidates) {
                if (!(await this.isHubTaskActive(candidate.sessionName, params.activeHubTaskStatus))) {
                    continue;
                }
                if (sentCount > 0) {
                    await this.sleeper.sleep(params.staggerSeconds * 1000);
                }
                await this.notificationRepository.sendSelfCheckNotification(candidate.sessionName, candidate.message);
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
                    console.log(`Hub task ${hubTaskIssueUrl} for session ${sessionName} is not a resolvable tracked task; sending notification (fail-open).`);
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
            const subAgentsBySessionName = await this.subAgentActivityRepository.listSubAgentActivitiesBySessionName(sessionNames, transcriptPathBySessionName);
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
                sections.push(this.messageComposer.composeSubAgentSection(stalledSubAgents, {
                    subAgentSilentThresholdSeconds: thresholds.subAgentSilentThresholdSeconds,
                    subAgentRunningThresholdSeconds: thresholds.subAgentRunningThresholdSeconds,
                }));
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