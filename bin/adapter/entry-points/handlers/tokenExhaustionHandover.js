"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTokenExhaustionHandover = void 0;
const TokenExhaustionHandoverUseCase_1 = require("../../../domain/usecases/TokenExhaustionHandoverUseCase");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const RateLimitSnapshotRepository_1 = require("../../repositories/RateLimitSnapshotRepository");
const ProcClaudeHandoverSessionRepository_1 = require("../../repositories/ProcClaudeHandoverSessionRepository");
const NodeProcessSignalRepository_1 = require("../../repositories/NodeProcessSignalRepository");
const FileHandoverStateRepository_1 = require("../../repositories/FileHandoverStateRepository");
const handleTokenExhaustionHandover = async (params) => {
    const { enabled, tokenListJsonPath, handoverMessage, bareNameLeaderHandoverMessage, tokenRateLimitSnapshotBaseDir, gracePeriodSeconds, stateFilePath, localCommandRunner, now, } = params;
    if (tokenListJsonPath === null) {
        console.log('Token exhaustion handover: skipped (no claudeCodeOauthTokenListJsonPath configured).');
        return;
    }
    const snapshotRepository = new RateLimitSnapshotRepository_1.RateLimitSnapshotRepository(tokenListJsonPath, tokenRateLimitSnapshotBaseDir ?? undefined);
    const stateRepository = new FileHandoverStateRepository_1.FileHandoverStateRepository(stateFilePath ?? (0, FileHandoverStateRepository_1.defaultHandoverStateFilePath)());
    const useCase = new TokenExhaustionHandoverUseCase_1.TokenExhaustionHandoverUseCase(new ProcClaudeHandoverSessionRepository_1.ProcClaudeHandoverSessionRepository(), snapshotRepository, new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner), new NodeProcessSignalRepository_1.NodeProcessSignalRepository());
    const result = await useCase.run({
        enabled,
        issueUrlLeaderMessage: handoverMessage ?? TokenExhaustionHandoverUseCase_1.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
        bareNameLeaderMessage: bareNameLeaderHandoverMessage ??
            TokenExhaustionHandoverUseCase_1.DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER,
        gracePeriodSeconds: gracePeriodSeconds ?? TokenExhaustionHandoverUseCase_1.DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
        state: stateRepository.load(),
        now,
    });
    stateRepository.save(result.state);
};
exports.handleTokenExhaustionHandover = handleTokenExhaustionHandover;
//# sourceMappingURL=tokenExhaustionHandover.js.map