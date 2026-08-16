"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemConsoleTabsRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const consoleTabNames_1 = require("../console/consoleTabNames");
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const writeJsonAtomic = (filePath, data) => {
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(data));
    fs_1.default.renameSync(tmpPath, filePath);
};
const readTabListJson = (filePath) => {
    try {
        const raw = fs_1.default.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
};
const clearProjectItemIdFromDoneJson = (doneFilePath, projectItemId) => {
    let existingIds = [];
    try {
        const raw = fs_1.default.readFileSync(doneFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (isRecord(parsed)) {
            const rawIds = parsed.projectItemIds;
            if (Array.isArray(rawIds)) {
                existingIds = rawIds.filter((id) => typeof id === 'string');
            }
        }
    }
    catch {
        // File does not exist; start with empty list
    }
    writeJsonAtomic(doneFilePath, {
        projectItemIds: existingIds.filter((id) => id !== projectItemId),
    });
};
class FileSystemConsoleTabsRepository {
    constructor(consoleDataOutputDir, pjcode) {
        this.consoleDataOutputDir = consoleDataOutputDir;
        this.pjcode = pjcode;
    }
    patchIssueTabTransition(params) {
        const { projectItemId, item, targetTabName } = params;
        for (const tabName of consoleTabNames_1.CONSOLE_LIST_TAB_NAMES) {
            const filePath = path_1.default.join(this.consoleDataOutputDir, this.pjcode, tabName, 'list.json');
            const existing = readTabListJson(filePath);
            if (existing === null) {
                continue;
            }
            const rawItems = existing.items;
            const items = Array.isArray(rawItems) ? rawItems : [];
            const withoutThisItem = items.filter((i) => !(isRecord(i) && i.projectItemId === projectItemId));
            if (tabName === targetTabName) {
                const rawStoryOrder = existing.storyOrder;
                const storyOrder = Array.isArray(rawStoryOrder)
                    ? rawStoryOrder.filter((s) => typeof s === 'string')
                    : [];
                const newItems = (0, consoleTabNames_1.sortByStoryOrder)([...withoutThisItem, item], storyOrder);
                writeJsonAtomic(filePath, { ...existing, items: newItems });
                const doneFilePath = path_1.default.join(this.consoleDataOutputDir, this.pjcode, tabName, '.done.json');
                clearProjectItemIdFromDoneJson(doneFilePath, projectItemId);
            }
            else if (withoutThisItem.length !== items.length) {
                writeJsonAtomic(filePath, { ...existing, items: withoutThisItem });
            }
        }
    }
}
exports.FileSystemConsoleTabsRepository = FileSystemConsoleTabsRepository;
//# sourceMappingURL=FileSystemConsoleTabsRepository.js.map