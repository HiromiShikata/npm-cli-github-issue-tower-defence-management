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
exports.FileSystemInteractiveLiveSessionTranscriptResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const modifiedEpochMs = (filePath) => {
    try {
        const stats = fs.statSync(filePath);
        return stats.isFile() ? stats.mtimeMs : null;
    }
    catch {
        return null;
    }
};
/**
 * Resolves the real transcript path of an interactive Claude Code session from
 * the session id and config directory taken from the session's process
 * environment. The transcript lives at
 * `<configDir>/projects/<cwd-slug>/<sessionId>.jsonl`; this resolver scans the
 * `projects` subdirectories for a file named `<sessionId>.jsonl` and returns the
 * most recently modified match. Because resolution is keyed on the process
 * session id rather than on a session name or issue URL, a plain-named session
 * (for example one named `workbench`) resolves just as well as an issue-url
 * named one.
 */
class FileSystemInteractiveLiveSessionTranscriptResolver {
    constructor() {
        this.resolveTranscriptPaths = (sessions) => {
            const resolved = new Map();
            for (const session of sessions) {
                const transcriptPath = this.resolveTranscriptPath(session);
                if (transcriptPath !== null) {
                    resolved.set(session.sessionName, transcriptPath);
                }
            }
            return resolved;
        };
        this.resolveTranscriptPath = (session) => {
            const projectsDirectory = path.join(session.configDir, 'projects');
            let projectEntries;
            try {
                projectEntries = fs.readdirSync(projectsDirectory, {
                    withFileTypes: true,
                });
            }
            catch {
                return null;
            }
            const fileName = `${session.sessionId}.jsonl`;
            let latestPath = null;
            let latestEpochMs = -Infinity;
            for (const projectEntry of projectEntries) {
                if (!projectEntry.isDirectory()) {
                    continue;
                }
                const candidate = path.join(projectsDirectory, projectEntry.name, fileName);
                const epochMs = modifiedEpochMs(candidate);
                if (epochMs === null) {
                    continue;
                }
                if (epochMs > latestEpochMs) {
                    latestEpochMs = epochMs;
                    latestPath = candidate;
                }
            }
            return latestPath;
        };
    }
}
exports.FileSystemInteractiveLiveSessionTranscriptResolver = FileSystemInteractiveLiveSessionTranscriptResolver;
//# sourceMappingURL=FileSystemInteractiveLiveSessionTranscriptResolver.js.map