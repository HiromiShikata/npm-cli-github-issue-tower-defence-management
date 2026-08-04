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
exports.findConsoleItemUrl = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const consoleDoneStore_1 = require("./consoleDoneStore");
const CONSOLE_LIST_FILE_NAME = 'list.json';
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const readListItemUrls = (consoleDataOutputDir, pjcode, tab) => {
    const filePath = path.join(consoleDataOutputDir, pjcode, tab, CONSOLE_LIST_FILE_NAME);
    let raw;
    try {
        raw = fs.readFileSync(filePath, 'utf-8');
    }
    catch {
        return [];
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        return [];
    }
    if (!isRecord(parsed)) {
        return [];
    }
    const items = parsed.items;
    if (!Array.isArray(items)) {
        return [];
    }
    const urls = [];
    for (const item of items) {
        if (!isRecord(item)) {
            continue;
        }
        const url = item.url;
        if (typeof url === 'string' && url.length > 0) {
            urls.push(url);
        }
    }
    return urls;
};
const findConsoleItemUrl = (consoleDataOutputDir, pjcode, requestedUrl) => {
    for (const tab of consoleDoneStore_1.CONSOLE_DONE_TAB_NAMES) {
        for (const url of readListItemUrls(consoleDataOutputDir, pjcode, tab)) {
            if (url === requestedUrl) {
                return url;
            }
        }
    }
    return null;
};
exports.findConsoleItemUrl = findConsoleItemUrl;
//# sourceMappingURL=consoleItemUrlLookup.js.map