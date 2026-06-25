"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcileInTmuxByHumanSessions = void 0;
const InTmuxByHumanSessionReconcileUseCase_1 = require("../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase");
const NodeTmuxSessionRepository_1 = require("../../repositories/NodeTmuxSessionRepository");
const reconcileInTmuxByHumanSessions = async (params) => {
    const { inTmuxLauncherCommand, assigneeLogin, issues, localCommandRunner, now, } = params;
    if (!inTmuxLauncherCommand || !assigneeLogin) {
        return;
    }
    const useCase = new InTmuxByHumanSessionReconcileUseCase_1.InTmuxByHumanSessionReconcileUseCase(new NodeTmuxSessionRepository_1.NodeTmuxSessionRepository(localCommandRunner));
    await useCase.run({
        issues,
        assigneeLogin,
        launcherCommand: inTmuxLauncherCommand,
        now,
    });
};
exports.reconcileInTmuxByHumanSessions = reconcileInTmuxByHumanSessions;
//# sourceMappingURL=inTmuxByHumanSessionReconciler.js.map