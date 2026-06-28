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
const os = __importStar(require("os"));
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
const defaultSharedProjectsDirectory = () => path.join(os.homedir(), '.claude', 'projects');
class FileSystemInteractiveLiveSessionTranscriptResolver {
    constructor(sharedProjectsDirectory = defaultSharedProjectsDirectory()) {
        this.sharedProjectsDirectory = sharedProjectsDirectory;
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
            const projectsDirectories = this.listProjectsDirectories(session.configDir);
            let latestPath = null;
            let latestEpochMs = -Infinity;
            for (const candidateSessionId of session.candidateSessionIds) {
                const fileName = `${candidateSessionId}.jsonl`;
                for (const projectsDirectory of projectsDirectories) {
                    for (const candidate of this.listCandidatePaths(projectsDirectory, fileName)) {
                        const epochMs = modifiedEpochMs(candidate);
                        if (epochMs === null) {
                            continue;
                        }
                        if (epochMs > latestEpochMs) {
                            latestEpochMs = epochMs;
                            latestPath = candidate;
                        }
                    }
                }
            }
            return latestPath;
        };
        this.listProjectsDirectories = (configDir) => {
            const perSessionProjectsDirectory = path.join(configDir, 'projects');
            if (perSessionProjectsDirectory === this.sharedProjectsDirectory) {
                return [perSessionProjectsDirectory];
            }
            return [perSessionProjectsDirectory, this.sharedProjectsDirectory];
        };
        this.listCandidatePaths = (projectsDirectory, fileName) => {
            let projectEntries;
            try {
                projectEntries = fs.readdirSync(projectsDirectory, {
                    withFileTypes: true,
                });
            }
            catch {
                return [];
            }
            const candidatePaths = [];
            for (const projectEntry of projectEntries) {
                if (!projectEntry.isDirectory()) {
                    continue;
                }
                candidatePaths.push(path.join(projectsDirectory, projectEntry.name, fileName));
            }
            return candidatePaths;
        };
    }
}
exports.FileSystemInteractiveLiveSessionTranscriptResolver = FileSystemInteractiveLiveSessionTranscriptResolver;
//# sourceMappingURL=FileSystemInteractiveLiveSessionTranscriptResolver.js.map