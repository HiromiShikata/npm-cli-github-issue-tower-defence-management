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
exports.loadTokens = exports.loadTokenEntries = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const expandHome = (filePath) => {
    if (filePath.startsWith('~/')) {
        return path.join(os.homedir(), filePath.slice(2));
    }
    if (filePath === '~') {
        return os.homedir();
    }
    return filePath;
};
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const loadTokenEntries = (jsonPath) => {
    const resolved = expandHome(jsonPath);
    if (!fs.existsSync(resolved))
        return null;
    try {
        const raw = fs.readFileSync(resolved, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return null;
        const entries = [];
        for (const entry of parsed) {
            if (isRecord(entry) &&
                typeof entry.token === 'string' &&
                typeof entry.name === 'string') {
                entries.push({ name: entry.name, token: entry.token });
            }
            else if (isRecord(entry) && typeof entry.token === 'string') {
                entries.push({ name: '', token: entry.token });
            }
        }
        return entries.length > 0 ? entries : null;
    }
    catch {
        return null;
    }
};
exports.loadTokenEntries = loadTokenEntries;
const loadTokens = (jsonPath) => {
    const entries = (0, exports.loadTokenEntries)(jsonPath);
    if (entries === null)
        return null;
    return entries.map((e) => e.token);
};
exports.loadTokens = loadTokens;
//# sourceMappingURL=TokenListLoader.js.map