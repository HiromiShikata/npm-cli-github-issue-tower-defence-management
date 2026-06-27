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
exports.ProcFsProcessEnvironReader = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Reads a process environment from the Linux procfs (`/proc/<pid>/environ`),
 * where entries are NUL-separated `KEY=value` pairs. Returns null when the
 * environment cannot be read (the process has exited or is not accessible).
 */
class ProcFsProcessEnvironReader {
    constructor(procDirectory = '/proc') {
        this.procDirectory = procDirectory;
        this.readEnviron = (pid) => {
            let raw;
            try {
                raw = fs.readFileSync(path.join(this.procDirectory, String(pid), 'environ'), 'utf8');
            }
            catch {
                return null;
            }
            const environ = {};
            for (const entry of raw.split('\0')) {
                if (entry.length === 0) {
                    continue;
                }
                const separatorIndex = entry.indexOf('=');
                if (separatorIndex === -1) {
                    continue;
                }
                const key = entry.slice(0, separatorIndex);
                const value = entry.slice(separatorIndex + 1);
                environ[key] = value;
            }
            return environ;
        };
    }
}
exports.ProcFsProcessEnvironReader = ProcFsProcessEnvironReader;
//# sourceMappingURL=ProcFsProcessEnvironReader.js.map