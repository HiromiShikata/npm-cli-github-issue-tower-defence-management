"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanClosedIssueOwnerCallFiles = void 0;
const InTmuxByHumanSessionReconcileUseCase_1 = require("../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase");
const ownerCallFileStore_1 = require("./ownerCallFileStore");
const cleanClosedIssueOwnerCallFiles = (params) => {
    const { inTmuxDataOutputDir, pjcode, issues } = params;
    if (!inTmuxDataOutputDir || !pjcode) {
        return;
    }
    for (const issue of issues.filter((candidate) => candidate.isClosed)) {
        (0, ownerCallFileStore_1.ownerCallFileDelete)({
            dataDir: inTmuxDataOutputDir,
            projectCode: pjcode,
            sessionName: (0, InTmuxByHumanSessionReconcileUseCase_1.toTmuxSessionName)(issue.url),
        });
    }
};
exports.cleanClosedIssueOwnerCallFiles = cleanClosedIssueOwnerCallFiles;
//# sourceMappingURL=ownerCallFileCleaner.js.map