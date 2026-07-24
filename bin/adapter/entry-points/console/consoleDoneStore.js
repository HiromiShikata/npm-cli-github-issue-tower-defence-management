"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDoneProjectItemIdsAcrossTabs = exports.resetDoneProjectItemIds = exports.recordDoneProjectItemIdAcrossTabs = exports.CONSOLE_DONE_TAB_NAMES = exports.recordDoneProjectItemId = exports.readDoneProjectItemIds = exports.doneFilePathForTab = exports.CONSOLE_DONE_FILE_NAME = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.CONSOLE_DONE_FILE_NAME = '.done.json';
const isValidProjectItemId = (value) => typeof value === 'string' && value.length > 0;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const parseDoneRecord = (raw) => {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) {
        return { projectItemIds: [] };
    }
    const rawProjectItemIds = parsed.projectItemIds;
    if (!Array.isArray(rawProjectItemIds)) {
        return { projectItemIds: [] };
    }
    const projectItemIds = rawProjectItemIds.filter(isValidProjectItemId);
    return { projectItemIds };
};
const doneFilePathForTab = (consoleDataOutputDir, pjcode, tab) => path.join(consoleDataOutputDir, pjcode, tab, exports.CONSOLE_DONE_FILE_NAME);
exports.doneFilePathForTab = doneFilePathForTab;
const writeDoneRecordAtomic = (filePath, record) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(record));
    fs.renameSync(tmpPath, filePath);
};
const readDoneProjectItemIds = (consoleDataOutputDir, pjcode, tab) => {
    const filePath = (0, exports.doneFilePathForTab)(consoleDataOutputDir, pjcode, tab);
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return [];
    }
    return parseDoneRecord(raw).projectItemIds;
};
exports.readDoneProjectItemIds = readDoneProjectItemIds;
const recordDoneProjectItemId = (consoleDataOutputDir, pjcode, tab, projectItemId) => {
    if (!isValidProjectItemId(projectItemId)) {
        return;
    }
    const filePath = (0, exports.doneFilePathForTab)(consoleDataOutputDir, pjcode, tab);
    const existing = (0, exports.readDoneProjectItemIds)(consoleDataOutputDir, pjcode, tab);
    if (existing.includes(projectItemId)) {
        return;
    }
    const updated = {
        projectItemIds: [...existing, projectItemId],
    };
    writeDoneRecordAtomic(filePath, updated);
};
exports.recordDoneProjectItemId = recordDoneProjectItemId;
exports.CONSOLE_DONE_TAB_NAMES = [
    'workflow-blocker',
    'prs',
    'triage',
    'unread',
    'failed-preparation',
    'todo-by-human',
    'todo-by-agent',
    'in-tmux-by-human',
];
const recordDoneProjectItemIdAcrossTabs = (consoleDataOutputDir, pjcode, projectItemId) => {
    for (const tab of exports.CONSOLE_DONE_TAB_NAMES) {
        (0, exports.recordDoneProjectItemId)(consoleDataOutputDir, pjcode, tab, projectItemId);
    }
};
exports.recordDoneProjectItemIdAcrossTabs = recordDoneProjectItemIdAcrossTabs;
const resetDoneProjectItemIds = (consoleDataOutputDir, pjcode, tab) => {
    const filePath = (0, exports.doneFilePathForTab)(consoleDataOutputDir, pjcode, tab);
    writeDoneRecordAtomic(filePath, { projectItemIds: [] });
};
exports.resetDoneProjectItemIds = resetDoneProjectItemIds;
const resetDoneProjectItemIdsAcrossTabs = (consoleDataOutputDir, pjcode) => {
    for (const tab of exports.CONSOLE_DONE_TAB_NAMES) {
        (0, exports.resetDoneProjectItemIds)(consoleDataOutputDir, pjcode, tab);
    }
};
exports.resetDoneProjectItemIdsAcrossTabs = resetDoneProjectItemIdsAcrossTabs;
//# sourceMappingURL=consoleDoneStore.js.map