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
exports.FileHandoverStateRepository = exports.defaultHandoverStateFilePath = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const defaultHandoverStateFilePath = () => {
    const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(base, 'tdpm', 'token-exhaustion-handover-state-tdpm-native.json');
};
exports.defaultHandoverStateFilePath = defaultHandoverStateFilePath;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
class FileHandoverStateRepository {
    constructor(filePath = (0, exports.defaultHandoverStateFilePath)()) {
        this.filePath = filePath;
        this.load = () => {
            let raw;
            try {
                raw = fs.readFileSync(this.filePath, 'utf8');
            }
            catch {
                return { entries: {} };
            }
            let parsed;
            try {
                parsed = JSON.parse(raw);
            }
            catch {
                return { entries: {} };
            }
            return { entries: this.parseEntries(parsed) };
        };
        this.save = (state) => {
            const directory = path.dirname(this.filePath);
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            const temporaryPath = `${this.filePath}.tmp`;
            fs.writeFileSync(temporaryPath, JSON.stringify(state));
            fs.renameSync(temporaryPath, this.filePath);
        };
        this.parseEntries = (parsed) => {
            const entries = {};
            if (!isRecord(parsed)) {
                return entries;
            }
            const stored = parsed.entries;
            if (!isRecord(stored)) {
                return entries;
            }
            for (const [key, value] of Object.entries(stored)) {
                if (!isRecord(value)) {
                    continue;
                }
                const signaledAtEpoch = value.signaledAtEpoch;
                const pid = value.pid;
                if (typeof signaledAtEpoch === 'number' && typeof pid === 'number') {
                    entries[key] = { signaledAtEpoch, pid };
                }
            }
            return entries;
        };
    }
}
exports.FileHandoverStateRepository = FileHandoverStateRepository;
//# sourceMappingURL=FileHandoverStateRepository.js.map