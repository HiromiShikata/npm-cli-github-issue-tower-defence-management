"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanStaleTmuxSessions = void 0;
const StaleTmuxSessionKillUseCase_1 = require("../../../domain/usecases/StaleTmuxSessionKillUseCase");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const cleanStaleTmuxSessions = async (params) => {
    const { project, allowCacheMinutes, issueRepository, localCommandRunner, now, } = params;
    const useCase = new StaleTmuxSessionKillUseCase_1.StaleTmuxSessionKillUseCase(issueRepository, new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner));
    await useCase.run({
        project,
        allowCacheMinutes,
        excludedStatus: StaleTmuxSessionKillUseCase_1.DEFAULT_EXCLUDED_STATUS,
        idleThresholdSeconds: StaleTmuxSessionKillUseCase_1.DEFAULT_IDLE_THRESHOLD_SECONDS,
        now,
    });
};
exports.cleanStaleTmuxSessions = cleanStaleTmuxSessions;
//# sourceMappingURL=staleTmuxSessionCleaner.js.map