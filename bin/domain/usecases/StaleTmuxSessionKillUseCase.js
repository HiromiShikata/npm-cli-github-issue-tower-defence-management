"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaleTmuxSessionKillUseCase = exports.DEFAULT_IDLE_THRESHOLD_SECONDS = exports.DEFAULT_EXCLUDED_STATUS = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const InTmuxByHumanSessionReconcileUseCase_1 = require("./intmux/InTmuxByHumanSessionReconcileUseCase");
exports.DEFAULT_EXCLUDED_STATUS = WorkflowStatus_1.IN_TMUX_STATUS_NAME;
exports.DEFAULT_IDLE_THRESHOLD_SECONDS = 24 * 60 * 60;
class StaleTmuxSessionKillUseCase {
    constructor(issueRepository, tmuxSessionRepository) {
        this.issueRepository = issueRepository;
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.run = async (params) => {
            const liveSessions = await this.tmuxSessionRepository.listLiveSessionsWithActivity();
            const openIssues = await this.issueRepository.getAllOpened(params.project);
            const issueBySessionName = new Map();
            for (const issue of openIssues) {
                issueBySessionName.set((0, InTmuxByHumanSessionReconcileUseCase_1.toTmuxSessionName)(issue.url), issue);
            }
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            const killCandidates = [];
            for (const session of liveSessions) {
                const reason = this.evaluateKillReason(session, issueBySessionName.get(session.sessionName) ?? null, nowEpochSeconds, params.excludedStatus, params.idleThresholdSeconds);
                if (reason !== null) {
                    killCandidates.push({ sessionName: session.sessionName, reason });
                }
            }
            console.log(`Stale tmux session cleanup: ${killCandidates.length} kill candidate(s) of ${liveSessions.length} live session(s).`);
            for (const candidate of killCandidates) {
                console.log(`Kill candidate: ${candidate.sessionName} (${candidate.reason})`);
            }
            for (const candidate of killCandidates) {
                await this.tmuxSessionRepository.killSession(candidate.sessionName);
                console.log(`Killed tmux session: ${candidate.sessionName} (${candidate.reason})`);
            }
        };
        this.evaluateKillReason = (session, issue, nowEpochSeconds, excludedStatus, idleThresholdSeconds) => {
            if (issue !== null) {
                if (issue.status !== excludedStatus) {
                    return `mapped to open issue ${issue.url} with status "${issue.status ?? 'null'}" which is not the excluded status "${excludedStatus}"`;
                }
                if (issue.nextActionDate !== null) {
                    return `mapped to open issue ${issue.url} which has a next action date set`;
                }
                if (issue.nextActionHour !== null) {
                    return `mapped to open issue ${issue.url} which has a next action hour set`;
                }
                return null;
            }
            const idleSeconds = nowEpochSeconds - session.activityEpochSeconds;
            if (idleSeconds >= idleThresholdSeconds) {
                return `maps to no open issue and has been idle for ${idleSeconds} seconds (threshold ${idleThresholdSeconds} seconds)`;
            }
            return null;
        };
    }
}
exports.StaleTmuxSessionKillUseCase = StaleTmuxSessionKillUseCase;
//# sourceMappingURL=StaleTmuxSessionKillUseCase.js.map