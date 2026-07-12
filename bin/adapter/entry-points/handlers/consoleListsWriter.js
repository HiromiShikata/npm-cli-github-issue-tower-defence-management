"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeConsoleLists = exports.formatConsoleGeneratedAt = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const GenerateConsoleListsUseCase_1 = require("../../../domain/usecases/console/GenerateConsoleListsUseCase");
const consoleDoneStore_1 = require("../console/consoleDoneStore");
const CONSOLE_TAB_NAMES = [
    'workflow-blocker',
    'prs',
    'triage',
    'unread',
    'failed-preparation',
    'todo-by-human',
];
const formatConsoleGeneratedAt = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');
exports.formatConsoleGeneratedAt = formatConsoleGeneratedAt;
const writeJsonAtomic = (filePath, data) => {
    const dir = path_1.default.dirname(filePath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const writeConsoleLists = (params) => {
    const { consoleDataOutputDir, pjcode, assigneeLogin } = params;
    if (!consoleDataOutputDir || !pjcode || !assigneeLogin) {
        return;
    }
    const generatedAt = params.generatedAt ?? (0, exports.formatConsoleGeneratedAt)(new Date());
    const lists = new GenerateConsoleListsUseCase_1.GenerateConsoleListsUseCase().run({
        project: params.project,
        issues: params.issues,
        pjcode,
        assigneeLogin,
        generatedAt,
        workflowBlockerStoryName: params.workflowBlockerStoryName ?? null,
    });
    for (const tab of CONSOLE_TAB_NAMES) {
        writeJsonAtomic(path_1.default.join(consoleDataOutputDir, pjcode, tab, 'list.json'), lists[tab]);
    }
    (0, consoleDoneStore_1.resetDoneProjectItemIdsAcrossTabs)(consoleDataOutputDir, pjcode);
};
exports.writeConsoleLists = writeConsoleLists;
//# sourceMappingURL=consoleListsWriter.js.map