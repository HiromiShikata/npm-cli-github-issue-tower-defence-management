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
exports.FileSystemSessionOutputActivityRepository = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileSystemSessionOutputActivityRepository {
    constructor(rootDirectory) {
        this.rootDirectory = rootDirectory;
        this.listSessionOutputActivities = async (sessionNames) => {
            if (this.rootDirectory === null) {
                return [];
            }
            const activities = [];
            for (const sessionName of sessionNames) {
                const lastOutputEpochSeconds = this.readLastOutputEpochSeconds(sessionName);
                if (lastOutputEpochSeconds !== null) {
                    activities.push({ sessionName, lastOutputEpochSeconds });
                }
            }
            return activities;
        };
        this.readLastOutputEpochSeconds = (sessionName) => {
            if (this.rootDirectory === null) {
                return null;
            }
            const filePath = path.join(this.rootDirectory, this.toOutputFileName(sessionName));
            let stats;
            try {
                stats = fs.statSync(filePath);
            }
            catch {
                return null;
            }
            if (!stats.isFile()) {
                return null;
            }
            return Math.floor(stats.mtimeMs / 1000);
        };
        this.toOutputFileName = (sessionName) => sessionName.replace(/\//g, '_');
    }
}
exports.FileSystemSessionOutputActivityRepository = FileSystemSessionOutputActivityRepository;
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.js.map