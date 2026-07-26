"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionOutputDegenerationRecoveryUseCase = exports.DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE = exports.DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS = exports.DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS = void 0;
const OutputDegenerationDetector_1 = require("./OutputDegenerationDetector");
const ResolveInteractiveLiveSessionsUseCase_1 = require("./ResolveInteractiveLiveSessionsUseCase");
const NotifySilentLiveSessionsUseCase_1 = require("./NotifySilentLiveSessionsUseCase");
exports.DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS = 5;
exports.DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS = 300;
exports.DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE = 'OUTPUT DEGENERATION DETECTED: your session is about to be reset. Immediately write a checkpoint to your assigned task issue (single concrete next action to resume, working directory and branch, in-flight sub-agent branch/PR URLs).';
class SessionOutputDegenerationRecoveryUseCase {
    constructor(liveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver, assistantTurnsRepository, notificationRepository, tmuxSessionRepository, cooldownStateRepository, sleeper, detector = new OutputDegenerationDetector_1.OutputDegenerationDetector()) {
        this.liveSessionProcessSnapshotProvider = liveSessionProcessSnapshotProvider;
        this.interactiveLiveSessionTranscriptResolver = interactiveLiveSessionTranscriptResolver;
        this.assistantTurnsRepository = assistantTurnsRepository;
        this.notificationRepository = notificationRepository;
        this.tmuxSessionRepository = tmuxSessionRepository;
        this.cooldownStateRepository = cooldownStateRepository;
        this.sleeper = sleeper;
        this.detector = detector;
        this.resolveInteractiveLiveSessions = new ResolveInteractiveLiveSessionsUseCase_1.ResolveInteractiveLiveSessionsUseCase();
        this.run = async (params) => {
            const snapshot = await this.liveSessionProcessSnapshotProvider.getSnapshot();
            const allInteractiveSessions = this.resolveInteractiveLiveSessions.resolve(snapshot);
            const interactiveSessions = allInteractiveSessions.filter((session) => (0, NotifySilentLiveSessionsUseCase_1.isGitHubIssueOrPullRequestSessionName)(session.sessionName));
            const transcriptPathBySessionName = this.interactiveLiveSessionTranscriptResolver.resolveTranscriptPaths(interactiveSessions);
            const turnsBySessionName = await this.assistantTurnsRepository.listRecentAssistantTurnsBySessionName(transcriptPathBySessionName, OutputDegenerationDetector_1.OUTPUT_DEGENERATION_CROSS_TURN_WINDOW);
            const lastResetBySessionName = await this.cooldownStateRepository.loadLastResetEpochSecondsBySessionName();
            const nowEpochSeconds = Math.floor(params.now.getTime() / 1000);
            let detectedCount = 0;
            let resetCount = 0;
            let dryRunCount = 0;
            let cooldownSkippedCount = 0;
            for (const session of interactiveSessions) {
                const sessionName = session.sessionName;
                const lastResetEpochSeconds = lastResetBySessionName.get(sessionName);
                if (lastResetEpochSeconds !== undefined &&
                    nowEpochSeconds - lastResetEpochSeconds < params.cooldownSeconds) {
                    cooldownSkippedCount += 1;
                    continue;
                }
                const turns = turnsBySessionName.get(sessionName) ?? [];
                const newestTurn = turns.length > 0 ? turns[0] : null;
                const intraTurn = newestTurn !== null &&
                    this.detector.isIntraTurnDegeneration(newestTurn);
                const crossTurn = this.detector.detectCrossTurnDegeneration(turns);
                if (!intraTurn && crossTurn === null) {
                    continue;
                }
                detectedCount += 1;
                if (intraTurn && newestTurn !== null) {
                    const { token, run, total } = this.detector.maxConsecutiveShortTokenRun(newestTurn);
                    console.log(`Output degeneration detected (intra-turn) session=${sessionName} token=${JSON.stringify(token)} run=${run} turnTokens=${total} enabled=${params.enabled}`);
                }
                if (crossTurn !== null) {
                    console.log(`Output degeneration detected (cross-turn) session=${sessionName} token=${JSON.stringify(crossTurn.token)} turns=${crossTurn.turnCount}/${Math.min(turns.length, OutputDegenerationDetector_1.OUTPUT_DEGENERATION_CROSS_TURN_WINDOW)} enabled=${params.enabled}`);
                }
                if (params.enabled) {
                    try {
                        await this.notificationRepository.sendSelfCheckNotification(sessionName, params.warningMessage);
                        await this.sleeper.sleep(params.graceSeconds * 1000);
                        await this.tmuxSessionRepository.killSession(sessionName);
                        resetCount += 1;
                        console.log(`Output degeneration reset session=${sessionName} graceSeconds=${params.graceSeconds}`);
                    }
                    catch (error) {
                        console.error(`Failed to reset degenerated session ${sessionName}: ${error instanceof Error ? error.message : String(error)}`);
                        continue;
                    }
                }
                else {
                    dryRunCount += 1;
                    console.log(`Output degeneration dry-run: would warn and reset session=${sessionName}`);
                }
                await this.cooldownStateRepository.recordReset({
                    sessionName,
                    now: params.now,
                });
            }
            console.log(`Output degeneration recovery: detected ${detectedCount} degenerated session(s) of ${interactiveSessions.length} interactive session(s); reset ${resetCount}, dry-run would-reset ${dryRunCount}, cooldown-skipped ${cooldownSkippedCount}.`);
        };
    }
}
exports.SessionOutputDegenerationRecoveryUseCase = SessionOutputDegenerationRecoveryUseCase;
//# sourceMappingURL=SessionOutputDegenerationRecoveryUseCase.js.map