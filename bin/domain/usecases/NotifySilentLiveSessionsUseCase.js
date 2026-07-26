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
    constructor(liveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver, sessionOutputActivityRepository, subAgentActivityRepository, ownerCallStatusProvider, notificationRepository, candidateStateRepository, notifiedStateRepository, messageComposer, sleeper, hubTaskStatusResolver = null, hubTaskStatusCacheRepository = null, refusalTailStatusProvider = null) {
        this.liveSessionProcessSnapshotProvider = liveSessionProcessSnapshotProvider;
        this.interactiveLiveSessionTranscriptResolver = interactiveLiveSessionTranscriptResolver;
        this.sessionOutputActivityRepository = sessionOutputActivityRepository;
        this.subAgentActivityRepository = subAgentActivityRepository;
        this.ownerCallStatusProvider = ownerCallStatusProvider;
        this.notificationRepository = notificationRepository;
        this.candidateStateRepository = candidateStateRepository;
        this.notifiedStateRepository = notifiedStateRepository;
        this.messageComposer = messageComposer;
        this.sleeper = sleeper;
        this.hubTaskStatusResolver = hubTaskStatusResolver;
        this.hubTaskStatusCacheRepository = hubTaskStatusCacheRepository;
        this.refusalTailStatusProvider = refusalTailStatusProvider;
        this.resolveInteractiveLiveSessions = new ResolveInteractiveLiveSessionsUseCase_1.ResolveInteractiveLiveSessionsUseCase();
        this.run = async (params) => {
            const snapshot = await this.liveSessionProcessSnapshotProvider.getSnapshot();
            const allInteractiveSessions = this.resolveInteractiveLiveSessions.resolve(snapshot);
            // Resolve the on-disk Claude transcript for every interactive session
            // before any name-based narrowing. A resolvable transcript is the proof
            // that a session is a live Claude agent session (its transcript, keyed by
            // the session id, is actively present on disk), independent of how the tmux
            // session is named.
            const transcriptPathBySessionName = this.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(allInteractiveSessions);
            // Monitor a session when it is either named after a github.com issue or
            // pull-request URL (the hub-task sessions) or has a resolvable Claude agent
            // transcript (role-named resident leader / PM agent sessions such as app,
            // tdpm-cli, secretary, and the per-project *pm sessions). Gating the
            // broadened inclusion on the resolvable transcript rather than on merely
            // being a tmux session keeps the fail-direction safe: a genuine non-agent
            // interactive session — a login shell, or a viewer such as sso_login or a
            // tdpm viewer — exposes no Claude transcript on disk, so it is still
            // excluded and never reminded.
            const interactiveSessions = allInteractiveSessions.filter((session) => (0, exports.isGitHubIssueOrPullRequestSessionName)(session.sessionName) ||
                transcriptPathBySessionName.has(session.sessionName));
            const skippedNonAgentSessionCount = allInteractiveSessions.length - interactiveSessions.length;
            if (skippedNonAgentSessionCount > 0) {
                console.log(`Silent live session notification: ignoring ${skippedNonAgentSessionCount} interactive session(s) that are neither named after a github.com issue or pull-request URL nor have a resolvable Claude agent transcript.`);
            }
            // A session whose most recent assistant turn is a model refusal is
            // excluded from ALL reminder candidates (main-stall and sub-agent
            // branches alike): each reminder delivery re-sends the full session
            // context to the API and is guaranteed to produce another refusal, so
            // reminding such a session only burns tokens. The gate is state-based
            // (no time windows) and self-clears once a non-refusal assistant turn
            // appears after the refusal.
            const refusalTailedSessionNames = this.refusalTailStatusProvider === null
                ? new Set()
                : await this.refusalTailStatusProvider.listRefusalTailedSessionNames(transcriptPathBySessionName);
            const monitoredSessions = interactiveSessions.filter((session) => {
                if (!refusalTailedSessionNames.has(session.sessionName)) {
                    return true;
                }
                console.log(`Skipping ${session.sessionName}: last assistant turn was a model refusal; suppressing reminders until a non-refusal turn appears.`);
                return false;
            });
            const snapshots = await this.collectSnapshots(monitoredSessions, transcriptPathBySessionName, params.now);
            const candidates = [];
            for (const sessionSnapshot of snapshots) {
                const candidate = this.composeCandidate(sessionSnapshot, params);
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
            // Fire-once latch: the set of sessions already reminded during their
            // current silent episode. A session that is still a candidate this cycle
            // and was already reminded is NOT re-injected, so a continuous silent
            // episode produces exactly one reminder instead of one every schedule
            // cycle. The latch is keyed by the globally-unique session name and
            // persisted across the per-cycle fresh monitor process on disk.
            const currentCandidateSessionNames = new Set(candidates.map((candidate) => candidate.sessionName));
            const previouslyNotifiedSessionNames = await this.notifiedStateRepository.loadRecentNotifiedSessionNames({
                now: params.now,
                recencyWindowSeconds: params.candidateDebounceRecencyWindowSeconds,
            });
            let sentCount = 0;
            const notifiedThisCycleSessionNames = [];
            for (const candidate of debouncedCandidates) {
                if (previouslyNotifiedSessionNames.has(candidate.sessionName)) {
                    console.log(`Skipping ${candidate.sessionName}: the current silent-episode reminder was already delivered; not re-injecting until the condition resolves and re-arises.`);
                    continue;
                }
                if (!(await this.isHubTaskActive(candidate.sessionName, params.activeHubTaskStatus, params.hubTaskStatusCacheTtlSeconds, params.now))) {
                    continue;
                }
                if (sentCount > 0) {
                    await this.sleeper.sleep(params.staggerSeconds * 1000);
                }
                await this.notificationRepository.sendSelfCheckNotification(candidate.sessionName, candidate.message);
                sentCount += 1;
                notifiedThisCycleSessionNames.push(candidate.sessionName);
                // One line per send, grep-stable on the `Notified ` prefix: the
                // ISO-8601 UTC timestamp disambiguates concurrent schedule runs and
                // the section list records what the message actually contained.
                console.log(`Notified ${candidate.sessionName} at=${params.now.toISOString()} sections=[${candidate.sectionLabels.join(',')}]`);
            }
            // Persist the latch for the next cycle: keep every already-latched session
            // that is STILL a candidate (refreshing its timestamp so a continuous
            // episode stays latched) plus the sessions notified this cycle, and prune
            // any latched session that is no longer a candidate so its episode ends and
            // a later re-qualification fires a fresh reminder.
            const retainedNotifiedSessionNames = [
                ...previouslyNotifiedSessionNames,
            ].filter((sessionName) => currentCandidateSessionNames.has(sessionName));
            const notifiedSessionNamesToPersist = Array.from(new Set([
                ...retainedNotifiedSessionNames,
                ...notifiedThisCycleSessionNames,
            ]));
            await this.notifiedStateRepository.saveNotifiedSessionNames({
                sessionNames: notifiedSessionNamesToPersist,
                now: params.now,
            });
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
        this.composeCandidate = (snapshot, thresholds) => {
            const sections = [];
            const sectionLabels = [];
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
            // The main-stall reminder is driven purely by silence: a session that has
            // produced no assistant output for longer than the threshold is reminded
            // regardless of whether its transcript tail is an in-progress tool_use. A
            // session that merely looks busy (mid-tool-call) can in fact be stuck, so
            // its apparent busyness MUST NOT suppress the reminder; the reminder queues
            // cleanly into the session even when it is mid-turn. The only main-stall
            // suppression is an unanswered owner call, which is a real wait on the owner.
            const mainTriggered = mainSilentSeconds !== null &&
                mainSilentSeconds >= thresholds.mainSilentThresholdSeconds &&
                !suppressedByUnansweredOwnerCall;
            if (mainTriggered) {
                sections.push(this.messageComposer.composeMainStalledSection(mainSilentSeconds));
                sectionLabels.push('main-stalled');
            }
            const idleSubAgents = snapshot.subAgents.filter((subAgent) => !subAgent.waitingOnExternalProcess &&
                subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds);
            // The long-running advisory is gated on output recency, mirroring the
            // idle branch: a sub-agent that produced output recently is working, no
            // matter how long it has been running, so it is never selected. Only a
            // sub-agent that is BOTH long-running and quiet (and not waiting on a
            // live external process) qualifies, and it is re-selected on EVERY cycle
            // while the condition holds — there is intentionally no fire-once state
            // and no time-window suppression, matching the idle-branch semantics.
            const longRunningSubAgents = snapshot.subAgents.filter((subAgent) => !subAgent.waitingOnExternalProcess &&
                subAgent.runningSeconds >= thresholds.subAgentRunningThresholdSeconds &&
                subAgent.silentSeconds >= thresholds.subAgentSilentThresholdSeconds);
            if (idleSubAgents.length > 0 || longRunningSubAgents.length > 0) {
                sections.push(this.messageComposer.composeSubAgentSection({
                    idleSubAgents,
                    longRunningSubAgents,
                }));
                for (const subAgent of idleSubAgents) {
                    sectionLabels.push(`sub-agent-idle:${subAgent.label}`);
                }
                for (const subAgent of longRunningSubAgents) {
                    sectionLabels.push(`sub-agent-long-running:${subAgent.label}`);
                }
            }
            if (sections.length === 0) {
                return null;
            }
            return {
                sessionName: snapshot.sessionName,
                message: sections.join('\n\n'),
                sectionLabels,
            };
        };
    }
}
exports.NotifySilentLiveSessionsUseCase = NotifySilentLiveSessionsUseCase;
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.js.map