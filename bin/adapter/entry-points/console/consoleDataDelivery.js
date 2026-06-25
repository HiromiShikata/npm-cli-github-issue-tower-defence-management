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
exports.buildConsoleDataResponse = exports.parseConsoleDataRoute = exports.CONSOLE_LIST_TAB_NAMES = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const consoleDoneStore_1 = require("./consoleDoneStore");
exports.CONSOLE_LIST_TAB_NAMES = [
    'workflow-blocker',
    'prs',
    'triage',
    'unread',
    'failed-preparation',
    'todo-by-human',
];
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const isSafeSegment = (segment) => SAFE_SEGMENT.test(segment) && !segment.startsWith('.');
const parseConsoleDataRoute = (requestPath) => {
    const segments = requestPath
        .split('/')
        .filter((segment) => segment.length > 0);
    if (segments.length < 3 || segments[0] !== 'projects') {
        return null;
    }
    const pjcode = segments[1];
    if (!isSafeSegment(pjcode)) {
        return null;
    }
    const tab = segments[2];
    if (!isSafeSegment(tab)) {
        return null;
    }
    if (tab === 'in-tmux-by-human') {
        const rest = segments.slice(3);
        if (rest.length === 0 || rest.some((segment) => !isSafeSegment(segment))) {
            return null;
        }
        return { kind: 'in-tmux', pjcode, relativePath: rest.join('/') };
    }
    if (!exports.CONSOLE_LIST_TAB_NAMES.includes(tab)) {
        return null;
    }
    if (segments.length === 4 && segments[3] === 'list.json') {
        return { kind: 'list', pjcode, tab };
    }
    if (segments.length === 5 && segments[3] === 'detail') {
        const key = segments[4];
        if (!isSafeSegment(key) || !key.endsWith('.json')) {
            return null;
        }
        return { kind: 'detail', pjcode, tab, key };
    }
    return null;
};
exports.parseConsoleDataRoute = parseConsoleDataRoute;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readJsonFile = (filePath) => {
    let raw;
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            return { found: false };
        }
        raw = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return { found: false };
    }
    const data = JSON.parse(raw);
    return { found: true, data };
};
const isExcludedItem = (item, doneSet) => {
    if (!isRecord(item)) {
        return false;
    }
    const projectItemId = item.projectItemId;
    return typeof projectItemId === 'string' && doneSet.has(projectItemId);
};
const applyDoneExclusion = (listData, doneProjectItemIds) => {
    if (!isRecord(listData) || !Array.isArray(listData.items)) {
        return listData;
    }
    const doneSet = new Set(doneProjectItemIds);
    const items = listData.items.filter((item) => !isExcludedItem(item, doneSet));
    return { ...listData, items };
};
const buildConsoleDataResponse = (consoleDataOutputDir, route) => {
    if (route.kind === 'list') {
        const filePath = path.join(consoleDataOutputDir, route.pjcode, route.tab, 'list.json');
        const listResult = readJsonFile(filePath);
        if (!listResult.found) {
            return notFoundJson();
        }
        const doneProjectItemIds = (0, consoleDoneStore_1.readDoneProjectItemIds)(consoleDataOutputDir, route.pjcode, route.tab);
        const filtered = applyDoneExclusion(listResult.data, doneProjectItemIds);
        return okJson(filtered);
    }
    if (route.kind === 'detail') {
        const filePath = path.join(consoleDataOutputDir, route.pjcode, route.tab, 'detail', route.key);
        const detailResult = readJsonFile(filePath);
        if (!detailResult.found) {
            return notFoundJson();
        }
        return okJson(detailResult.data);
    }
    const inTmuxFilePath = path.join(consoleDataOutputDir, route.pjcode, 'in-tmux-by-human', route.relativePath);
    const inTmuxResult = readJsonFile(inTmuxFilePath);
    if (!inTmuxResult.found) {
        return notFoundJson();
    }
    return okJson(inTmuxResult.data);
};
exports.buildConsoleDataResponse = buildConsoleDataResponse;
const okJson = (data) => ({
    statusCode: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(data),
});
const notFoundJson = () => ({
    statusCode: 404,
    contentType: 'text/plain; charset=utf-8',
    body: 'Not Found',
});
//# sourceMappingURL=consoleDataDelivery.js.map