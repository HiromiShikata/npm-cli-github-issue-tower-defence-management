"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeDashboardRow = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GenerateDashboardRowUseCase_1 = require("../../../domain/usecases/dashboard/GenerateDashboardRowUseCase");
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const writeDashboardRow = (params) => {
    const { dashboardDataDir, pjcode, assigneeLogin, issues } = params;
    if (!dashboardDataDir || !pjcode || !assigneeLogin) {
        return;
    }
    const row = new GenerateDashboardRowUseCase_1.GenerateDashboardRowUseCase().run({
        issues,
        assigneeLogin,
    });
    const file = {
        pjcode,
        capturedAt: params.generatedAt ?? new Date().toISOString(),
        ...row,
    };
    writeJsonAtomic(path_1.default.join(dashboardDataDir, 'projects', `${pjcode}.json`), file);
};
exports.writeDashboardRow = writeDashboardRow;
//# sourceMappingURL=dashboardRowWriter.js.map