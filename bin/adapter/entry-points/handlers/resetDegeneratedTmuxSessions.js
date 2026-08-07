"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS = exports.resetDegeneratedTmuxSessions = void 0;
const SessionOutputDegenerationRecoveryUseCase_1 = require("../../../domain/usecases/SessionOutputDegenerationRecoveryUseCase");
const LocalProcessLiveSessionProcessSnapshotProvider_1 = require("../../repositories/LocalProcessLiveSessionProcessSnapshotProvider");
const ProcFsProcessEnvironReader_1 = require("../../repositories/ProcFsProcessEnvironReader");
const FileSystemInteractiveLiveSessionTranscriptResolver_1 = require("../../repositories/FileSystemInteractiveLiveSessionTranscriptResolver");
const FileSystemSessionAssistantTurnsRepository_1 = require("../../repositories/FileSystemSessionAssistantTurnsRepository");
const FileSystemSessionDegenerationCooldownStateRepository_1 = require("../../repositories/FileSystemSessionDegenerationCooldownStateRepository");
const TmuxSilentSessionNotificationRepository_1 = require("../../repositories/TmuxSilentSessionNotificationRepository");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const RealSleeper_1 = require("../../repositories/RealSleeper");
const resetDegeneratedTmuxSessions = async (params) => {
    const { enabled, localCommandRunner, processEnvironReader, warningMessage, graceSeconds, cooldownSeconds, cooldownStateFilePath, now, } = params;
    const useCase = new SessionOutputDegenerationRecoveryUseCase_1.SessionOutputDegenerationRecoveryUseCase(new LocalProcessLiveSessionProcessSnapshotProvider_1.LocalProcessLiveSessionProcessSnapshotProvider(localCommandRunner, processEnvironReader ?? new ProcFsProcessEnvironReader_1.ProcFsProcessEnvironReader()), new FileSystemInteractiveLiveSessionTranscriptResolver_1.FileSystemInteractiveLiveSessionTranscriptResolver(), new FileSystemSessionAssistantTurnsRepository_1.FileSystemSessionAssistantTurnsRepository(), new TmuxSilentSessionNotificationRepository_1.TmuxSilentSessionNotificationRepository(localCommandRunner, new RealSleeper_1.RealSleeper()), new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner), cooldownStateFilePath !== null
        ? new FileSystemSessionDegenerationCooldownStateRepository_1.FileSystemSessionDegenerationCooldownStateRepository(cooldownStateFilePath)
        : new FileSystemSessionDegenerationCooldownStateRepository_1.FileSystemSessionDegenerationCooldownStateRepository(), new RealSleeper_1.RealSleeper());
    await useCase.run({
        enabled,
        warningMessage,
        graceSeconds,
        cooldownSeconds,
        now,
    });
};
exports.resetDegeneratedTmuxSessions = resetDegeneratedTmuxSessions;
exports.DEFAULT_RESET_DEGENERATED_TMUX_SESSIONS_PARAMS = {
    warningMessage: SessionOutputDegenerationRecoveryUseCase_1.DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE,
    graceSeconds: SessionOutputDegenerationRecoveryUseCase_1.DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS,
    cooldownSeconds: SessionOutputDegenerationRecoveryUseCase_1.DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS,
};
//# sourceMappingURL=resetDegeneratedTmuxSessions.js.map