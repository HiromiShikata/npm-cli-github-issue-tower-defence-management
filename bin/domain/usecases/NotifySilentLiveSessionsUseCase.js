"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotifySilentLiveSessionsUseCase = exports.isGitHubIssueOrPullRequestSessionName = exports.parseHubTaskIssueUrlFromSessionName = exports.DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS = exports.DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS = exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = exports.DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS = exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = void 0;
const ResolveInteractiveLiveSessionsUseCase_1 = require("./ResolveInteractiveLiveSessionsUseCase");
exports.DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS = 10 * 60;
// Retained only for backward compatibility of the configuration surface
// (TDPM_SILENT_UNANSWERED_OWNER_CALL_GRACE_SECONDS). The value is no longer
// consulted: an unanswered owner call suppresses the main-stall reminder
// unconditionally (treated as an infinite grace). See composeCandidate.
exports.DEFAULT_UNANSWERED_OWNER_CALL_GRACE_SECONDS = 60 * 60;
exports.DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS = 5 * 60;
exports.DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS = 15 * 60;
exports.DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
exports.DEFAULT_CANDIDATE_DEBOUNCE_RECENCY_WINDOW_SECONDS = 15 * 60;
exports.DEFAULT_HUB_TASK_STATUS_CACHE_TTL_SECONDS = 5 * 60;
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
    constructor(liveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver, sessionOutputActivityRepository, subAgentActivityRepository, ownerCallStatusProvider, notificationRepository, candidateStateRepository, messageComposer, sleeper, hubTaskStatusResolver = null, hubTaskStatusCacheRepository = null) {
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
        this.hubTaskStatusCacheRepository = hubTaskStatusCacheRepository;
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
                const candidate = await this.composeCandidate(sessionSnapshot, params);
                if (candidate !== null) {
                    candidates.push(candidate);
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
                if (!(await this.isHubTaskActive(candidate.sessionName, params.activeHubTaskStatus, params.hubTaskStatusCacheTtlSeconds, params.now))) {
                    continue;
                }
                if (sentCount > 0) {
                    await this.sleeper.sleep(params.staggerSeconds * 1000);
                }
                await this.notificationRepository.sendSelfCheckNotification(candidate.sessionName, candidate.message);
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
        this.isHubTaskActive = async (sessionName, activeHubTaskStatus, hubTaskStatusCacheTtlSeconds, now) => {
            if (activeHubTaskStatus === null || this.hubTaskStatusResolver === null) {
                return true;
            }
            const hubTaskIssueUrl = (0, exports.parseHubTaskIssueUrlFromSessionName)(sessionName);
            if (hubTaskIssueUrl === null) {
                return true;
            }
            const cachedEntry = this.hubTaskStatusCacheRepository === null
                ? null
                : await this.hubTaskStatusCacheRepository.loadHubTaskStatus({
                    url: hubTaskIssueUrl,
                });
            const nowEpochSeconds = Math.floor(now.getTime() / 1000);
            if (cachedEntry !== null) {
                const cacheAgeSeconds = nowEpochSeconds - cachedEntry.recordedEpochSeconds;
                if (cacheAgeSeconds <= hubTaskStatusCacheTtlSeconds) {
                    const active = this.isResolvedStatusActive(cachedEntry.state, cachedEntry.status, activeHubTaskStatus);
                    if (!active) {
                        console.log(`Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active per cached status (state "${cachedEntry.state}", status "${cachedEntry.status ?? 'null'}", active status "${activeHubTaskStatus}").`);
                    }
                    return active;
                }
            }
            const resolution = await this.tryResolveAndCacheHubTask(hubTaskIssueUrl, activeHubTaskStatus, sessionName, now);
            if (resolution.resolved) {
                return resolution.active;
            }
            if (cachedEntry !== null) {
                const active = this.isResolvedStatusActive(cachedEntry.state, cachedEntry.status, activeHubTaskStatus);
                console.warn(`Hub task ${hubTaskIssueUrl} for session ${sessionName} could not be resolved (${resolution.reason}); falling back to expired cached status (state "${cachedEntry.state}", status "${cachedEntry.status ?? 'null'}"), so the notification is ${active ? 'sent' : 'suppressed'}.`);
                return active;
            }
            console.warn(`Hub task ${hubTaskIssueUrl} for session ${sessionName} is not resolvable and has no cached status (${resolution.reason}); sending notification (fail-open).`);
            return true;
        };
        this.tryResolveAndCacheHubTask = async (hubTaskIssueUrl, activeHubTaskStatus, sessionName, now) => {
            if (this.hubTaskStatusResolver === null) {
                return { resolved: false, reason: 'resolver is not configured' };
            }
            let issue;
            try {
                issue = await this.hubTaskStatusResolver.getIssueByUrl(hubTaskIssueUrl);
            }
            catch (error) {
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
            const active = this.isResolvedStatusActive(issue.state, issue.status, activeHubTaskStatus);
            if (!active) {
                console.log(`Skipping ${sessionName}: hub task ${hubTaskIssueUrl} is no longer active (state "${issue.state}", status "${issue.status ?? 'null'}", active status "${activeHubTaskStatus}").`);
            }
            return { resolved: true, active };
        };
        this.isResolvedStatusActive = (state, status, activeHubTaskStatus) => state === 'OPEN' && status === activeHubTaskStatus;
        this.collectSnapshots = async (interactiveSessions, transcriptPathBySessionName, now) => {
            const sessionNames = interactiveSessions.map((session) => session.sessionName);
            const activities = await this.sessionOutputActivityRepository.listSessionOutputActivities(transcriptPathBySessionName);
            const lastOutputBySessionName = new Map();
            for (const activity of activities) {
                lastOutputBySessionName.set(activity.sessionName, activity.lastOutputEpochSeconds);
            }
            const subAgentsBySessionName = await this.subAgentActivityRepository.listSubAgentActivitiesBySessionName(sessionNames, transcriptPathBySessionName);
            const unansweredOwnerCallEpochSecondsBySessionName = await this.ownerCallStatusProvider.listUnansweredOwnerCallEpochSecondsBySessionName(transcriptPathBySessionName);
            const nowEpochSeconds = Math.floor(now.getTime() / 1000);
            return sessionNames.map((sessionName) => {
                const lastOutputEpochSeconds = lastOutputBySessionName.get(sessionName);
                const mainSilentSeconds = lastOutputEpochSeconds === undefined
                    ? null
                    : nowEpochSeconds - lastOutputEpochSeconds;
                const unansweredOwnerCallEpochSeconds = unansweredOwnerCallEpochSecondsBySessionName.get(sessionName);
                return {
                    sessionName,
                    mainSilentSeconds,
                    subAgents: subAgentsBySessionName.get(sessionName) ?? [],
                    unansweredOwnerCallAgeSeconds: unansweredOwnerCallEpochSeconds === undefined
                        ? null
                        : nowEpochSeconds - unansweredOwnerCallEpochSeconds,
                };
            });
        };
        this.composeCandidate = async (snapshot, thresholds) => {
            const sections = [];
            const mainSilentSeconds = snapshot.mainSilentSeconds;
            const unansweredOwnerCallAgeSeconds = snapshot.unansweredOwnerCallAgeSeconds;
            // Owner-defined rule: whenever the latest owner call is newer than the
            // latest owner reply (i.e. the call is unanswered), the session is
            // waiting on the owner and MUST NOT receive a main-stall reminder —
            // unconditionally, with no age or grace expiry. The persistent unread
            // indicator in the owner's app covers the missed-call case, so a
            // time-based re-fire is unnecessary. `unansweredOwnerCallGraceSeconds`
            // is retained in the parameters only for backward compatibility of the
            // call signature and is intentionally ignored (treated as infinite).
            const suppressedByUnansweredOwnerCall = unansweredOwnerCallAgeSeconds !== null;
            const mainTriggered = mainSilentSeconds !== null &&
                mainSilentSeconds >= thresholds.mainSilentThresholdSeconds &&
                !suppressedByUnansweredOwnerCall;
            if (mainTriggered) {
                sections.push(this.messageComposer.composeMainStalledSection(mainSilentSeconds));
            }
            const idleSubAgents = snapshot.subAgents.filter((subAgent) => !subAgent.waitingOnExternalProcess &&
                subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds);
            const longRunningSubAgents = snapshot.subAgents.filter((subAgent) => subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds);
            const retainedAnnouncedRunningLabels = await this.reconcileAnnouncedRunningLabels(snapshot, thresholds.now);
            const newlyLongRunningSubAgents = longRunningSubAgents.filter((subAgent) => !retainedAnnouncedRunningLabels.includes(subAgent.label));
            if (idleSubAgents.length > 0 || newlyLongRunningSubAgents.length > 0) {
                sections.push(this.messageComposer.composeSubAgentSection({
                    idleSubAgents,
                    longRunningSubAgents: newlyLongRunningSubAgents,
                }));
            }
            if (sections.length === 0) {
                return null;
            }
            return {
                sessionName: snapshot.sessionName,
                message: sections.join('\n\n'),
                newlyAnnouncedRunningLabels: newlyLongRunningSubAgents.map((subAgent) => subAgent.label),
                retainedAnnouncedRunningLabels,
            };
        };
        this.reconcileAnnouncedRunningLabels = async (snapshot, now) => {
            const announcedLabels = await this.candidateStateRepository.loadAnnouncedRunningSubAgentLabels({
                sessionName: snapshot.sessionName,
            });
            const currentLabels = new Set(snapshot.subAgents.map((subAgent) => subAgent.label));
            const retainedLabels = Array.from(announcedLabels).filter((label) => currentLabels.has(label));
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
}
exports.NotifySilentLiveSessionsUseCase = NotifySilentLiveSessionsUseCase;
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.js.map