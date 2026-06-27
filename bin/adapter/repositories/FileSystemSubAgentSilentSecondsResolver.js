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
exports.FileSystemSubAgentSilentSecondsResolver = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FileSystemSubAgentSilentSecondsResolver {
    constructor(rootDirectory, now) {
        this.rootDirectory = rootDirectory;
        this.now = now;
        this.resolveSilentSeconds = (label) => {
            if (this.rootDirectory === null) {
                return 0;
            }
            const filePath = path.join(this.rootDirectory, this.toFileName(label));
            let stats;
            try {
                stats = fs.statSync(filePath);
            }
            catch {
                return 0;
            }
            if (!stats.isFile()) {
                return 0;
            }
            const lastOutputEpochSeconds = Math.floor(stats.mtimeMs / 1000);
            const nowEpochSeconds = Math.floor(this.now.getTime() / 1000);
            const silentSeconds = nowEpochSeconds - lastOutputEpochSeconds;
            return silentSeconds > 0 ? silentSeconds : 0;
        };
        this.toFileName = (label) => label.replace(/\//g, '_');
    }
}
exports.FileSystemSubAgentSilentSecondsResolver = FileSystemSubAgentSilentSecondsResolver;
//# sourceMappingURL=FileSystemSubAgentSilentSecondsResolver.js.map