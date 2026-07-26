"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenExhaustionHandoverUseCase = exports.TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD = exports.TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD = exports.TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD = exports.TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD = exports.TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS = exports.TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = exports.DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS = exports.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER = exports.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE = void 0;
exports.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE = 'TOKEN NEAR EXHAUSTION. Within 2 minutes, write a CHECKPOINT to your assigned task issue: the in-flight subagents and what each is doing, their durable refs (branch and pull request URLs), the working directory and branch, the single concrete next action to resume, and the reason (token near exhaustion). Do this WITHOUT waiting for long-running or CI-watching subagents. Then self-kill your own tmux session with `tmux kill-session`.';
exports.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER = 'TOKEN NEAR EXHAUSTION. You are a resident leader with no assigned task issue. Within 2 minutes, write a CHECKPOINT for every in-flight subagent (what each is doing and its durable refs = branch and pull request URLs, plus the single concrete next action to resume and the working directory and branch) into the GitHub issue that each subagent is working on, WITHOUT waiting for long-running or CI-watching subagents. Then stop and stay idle; do NOT self-kill. This session will be terminated and relaunched on a token that still has quota so its work is preserved.';
exports.DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS = 180;
exports.TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS = 900;
exports.TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS = 3600;
exports.TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD = 0.1;
exports.TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD = 0.05;
exports.TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD = 0.25;
exports.TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD = 0.15;
class TokenExhaustionHandoverUseCase {
    constructor(handoverSessionRepository, snapshotRepository, tmuxSessionRepository, processSignalRepository) {
        this.handoverSessionRepository = handoverSessionRepository;
        this.snapshotRepository = snapshotRepository;
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.processSignalRepository = processSignalRepository;
        this.run = async (input) => {
            const nowEpochSeconds = Math.floor(input.now.getTime() / 1000);
            const sessions = this.handoverSessionRepository.listHandoverSessions();
            const snapshots = this.snapshotRepository.listSnapshots();
            const snapshotByToken = new Map(snapshots.map((snapshot) => [snapshot.token, snapshot]));
            const liveSessionNames = new Set(await this.tmuxSessionRepository.listLiveSessionNames());
            const nextEntries = {
                ...input.state.entries,
            };
            const newlyHandoverSentSessionNames = [];
            const killedSessionNames = [];
            const terminatedPids = [];
            const relaunchedLeaderNames = [];
            const leftAliveSessionNames = [];
            for (const session of sessions) {
                try {
                    const snapshot = snapshotByToken.get(session.token);
                    if (snapshot === undefined) {
                        continue;
                    }
                    const hasTmux = session.kind !== 'implSubagent';
                    const verdict = this.evaluateSnapshot(snapshot, nowEpochSeconds, hasTmux);
                    const stateKey = this.stateKeyFor(session);
                    if (verdict.stale) {
                        continue;
                    }
                    if (!verdict.exhausted) {
                        delete nextEntries[stateKey];
                        continue;
                    }
                    if (!this.isFresherTokenAvailable(session.token, snapshots, nowEpochSeconds)) {
                        console.log(`Token exhaustion handover: leaving ${this.displayName(session)} alive (token pool globally exhausted, no fresher token available)`);
                        leftAliveSessionNames.push(this.displayName(session));
                        continue;
                    }
                    const entry = nextEntries[stateKey];
                    if (entry === undefined) {
                        if (input.enabled) {
                            await this.sendHandover(session, input);
                        }
                        console.log(`Token exhaustion handover: signaled ${this.displayName(session)} kind=${session.kind} reason=${verdict.reason} enabled=${input.enabled}`);
                        nextEntries[stateKey] = {
                            signaledAtEpoch: nowEpochSeconds,
                            pid: session.pid,
                        };
                        newlyHandoverSentSessionNames.push(this.displayName(session));
                        continue;
                    }
                    if (nowEpochSeconds - entry.signaledAtEpoch <
                        input.gracePeriodSeconds) {
                        console.log(`Token exhaustion handover: waiting for grace period for ${this.displayName(session)} remainingSeconds=${input.gracePeriodSeconds - (nowEpochSeconds - entry.signaledAtEpoch)}`);
                        continue;
                    }
                    const alive = hasTmux
                        ? session.sessionName !== null &&
                            liveSessionNames.has(session.sessionName)
                        : this.processSignalRepository.isProcessAlive(entry.pid);
                    if (!alive) {
                        if (input.enabled && this.needsRelaunch(session)) {
                            await this.relaunchBareNameLeader(session, relaunchedLeaderNames);
                        }
                        delete nextEntries[stateKey];
                        continue;
                    }
                    if (!input.enabled) {
                        console.log(`Token exhaustion handover: would force-kill ${this.displayName(session)} kind=${session.kind} (dry-run, enabled=false)`);
                        delete nextEntries[stateKey];
                        continue;
                    }
                    await this.forceKill(session, entry);
                    if (this.needsRelaunch(session)) {
                        await this.relaunchBareNameLeader(session, relaunchedLeaderNames);
                    }
                    console.log(`Token exhaustion handover: force-killed ${this.displayName(session)} kind=${session.kind}`);
                    if (hasTmux) {
                        killedSessionNames.push(this.displayName(session));
                    }
                    else {
                        terminatedPids.push(entry.pid);
                    }
                    delete nextEntries[stateKey];
                }
                catch (error) {
                    console.error(`Token exhaustion handover: error processing ${this.displayName(session)}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            return {
                newlyHandoverSentSessionNames,
                killedSessionNames,
                terminatedPids,
                relaunchedLeaderNames,
                leftAliveSessionNames,
                state: { entries: nextEntries },
            };
        };
        this.needsRelaunch = (session) => session.kind === 'bareNameLeader' && session.name !== null;
        this.relaunchBareNameLeader = async (session, relaunchedLeaderNames) => {
            if (session.name === null) {
                return;
            }
            await this.tmuxSessionRepository.launchBareNameLeaderSession(session.name);
            relaunchedLeaderNames.push(session.name);
        };
        this.sendHandover = async (session, input) => {
            if (session.kind === 'implSubagent') {
                this.processSignalRepository.terminateProcess(session.pid);
                return;
            }
            if (session.sessionName === null) {
                return;
            }
            const message = session.kind === 'issueUrlLeader'
                ? input.issueUrlLeaderMessage
                : input.bareNameLeaderMessage;
            await this.tmuxSessionRepository.sendKeys(session.sessionName, message);
        };
        this.forceKill = async (session, entry) => {
            if (session.kind === 'implSubagent') {
                this.processSignalRepository.killProcess(entry.pid);
                return;
            }
            if (session.sessionName !== null) {
                try {
                    await this.tmuxSessionRepository.killSession(session.sessionName);
                }
                catch (error) {
                    console.error(`Token exhaustion handover: killSession failed for ${session.sessionName}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            this.processSignalRepository.killProcess(entry.pid);
        };
        this.stateKeyFor = (session) => session.kind === 'implSubagent'
            ? `pid:${session.pid}`
            : (session.sessionName ?? `pid:${session.pid}`);
        this.displayName = (session) => session.sessionName ?? `pid:${session.pid}`;
        this.isFresherTokenAvailable = (currentToken, snapshots, nowEpochSeconds) => {
            for (const snapshot of snapshots) {
                if (snapshot.token === currentToken) {
                    continue;
                }
                const verdict = this.evaluateSnapshot(snapshot, nowEpochSeconds, true);
                if (!verdict.stale && !verdict.exhausted) {
                    return true;
                }
            }
            return false;
        };
        this.evaluateSnapshot = (snapshot, nowEpochSeconds, hasTmux) => {
            const age = nowEpochSeconds - snapshot.lastUpdatedEpoch;
            const fiveHourFree = this.freeRatio(snapshot.fiveHourUtilization, snapshot.fiveHourReset, nowEpochSeconds);
            const sevenDayFree = this.freeRatio(snapshot.sevenDayUtilization, snapshot.sevenDayReset, nowEpochSeconds);
            const blocked = snapshot.blocked ||
                snapshot.rejected ||
                snapshot.blockedUntilEpoch > nowEpochSeconds;
            const weeklyCapped = this.isWeeklyCapped(snapshot.modelWeeklyLimits, nowEpochSeconds);
            if (age > exports.TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS) {
                return {
                    stale: true,
                    exhausted: false,
                    reason: 'hard_stale',
                    fiveHourFree,
                    sevenDayFree,
                    blocked,
                    weeklyCapped,
                };
            }
            const inWarningBand = fiveHourFree < exports.TOKEN_EXHAUSTION_FIVE_HOUR_WARNING_FREE_THRESHOLD ||
                sevenDayFree < exports.TOKEN_EXHAUSTION_SEVEN_DAY_WARNING_FREE_THRESHOLD ||
                blocked ||
                weeklyCapped;
            if (age > exports.TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS &&
                !inWarningBand) {
                return {
                    stale: true,
                    exhausted: false,
                    reason: 'stale_healthy',
                    fiveHourFree,
                    sevenDayFree,
                    blocked,
                    weeklyCapped,
                };
            }
            const exhausted = fiveHourFree < exports.TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD ||
                (hasTmux && sevenDayFree < exports.TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD) ||
                blocked ||
                weeklyCapped;
            const reason = weeklyCapped
                ? 'weekly_hard_cap_rejected'
                : fiveHourFree < exports.TOKEN_EXHAUSTION_FIVE_HOUR_FREE_THRESHOLD
                    ? 'five_hour_free_below_threshold'
                    : hasTmux && sevenDayFree < exports.TOKEN_EXHAUSTION_SEVEN_DAY_FREE_THRESHOLD
                        ? 'seven_day_free_below_threshold'
                        : blocked
                            ? 'blocked_or_rejected'
                            : 'healthy';
            return {
                stale: false,
                exhausted,
                reason,
                fiveHourFree,
                sevenDayFree,
                blocked,
                weeklyCapped,
            };
        };
        this.freeRatio = (utilization, resetEpoch, nowEpochSeconds) => {
            if (resetEpoch > 0 && nowEpochSeconds > resetEpoch) {
                return 1;
            }
            return 1 - this.clamp01(utilization);
        };
        this.clamp01 = (value) => {
            if (value < 0) {
                return 0;
            }
            if (value > 1) {
                return 1;
            }
            return value;
        };
        this.isWeeklyCapped = (modelWeeklyLimits, nowEpochSeconds) => {
            for (const limit of modelWeeklyLimits) {
                if (!limit.rejected) {
                    continue;
                }
                if (limit.resetsAt > 0 && nowEpochSeconds > limit.resetsAt) {
                    continue;
                }
                return true;
            }
            return false;
        };
    }
}
exports.TokenExhaustionHandoverUseCase = TokenExhaustionHandoverUseCase;
//# sourceMappingURL=TokenExhaustionHandoverUseCase.js.map