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
exports.OauthAPIClaudeMultiCandidateRepository = void 0;
const OauthAPIClaudeRepository_1 = require("./OauthAPIClaudeRepository");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class OauthAPIClaudeMultiCandidateRepository {
    constructor(candidates, homeDir) {
        this.candidates = candidates;
        this.homeDir = homeDir;
        this.weeklyWindowHours = 168;
        this.mainDir = path.join(homeDir, '.claude');
        this.mainRepository = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository(this.mainDir);
    }
    async isClaudeAvailable(threshold) {
        if (this.candidates.length === 0) {
            let usages;
            try {
                usages = await this.mainRepository.getUsage();
            }
            catch (error) {
                if (error instanceof OauthAPIClaudeRepository_1.ClaudeConfigDirCandidateUnavailableError) {
                    return false;
                }
                throw error;
            }
            return this.isNonWeeklyUnderThreshold(usages, threshold);
        }
        for (const candidate of this.candidates) {
            const candidateDir = path.join(this.homeDir, candidate);
            const repo = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository(candidateDir);
            let usages;
            try {
                usages = await repo.getUsage();
            }
            catch (error) {
                if (error instanceof OauthAPIClaudeRepository_1.ClaudeConfigDirCandidateUnavailableError) {
                    continue;
                }
                throw error;
            }
            if (this.isNonWeeklyUnderThreshold(usages, threshold)) {
                this.copyCandidate(candidateDir, this.mainDir);
                return true;
            }
        }
        return false;
    }
    async getUsage() {
        return this.mainRepository.getUsage();
    }
    copyCandidate(candidateDir, mainDir) {
        const credentialsSrc = path.join(candidateDir, '.credentials.json');
        const credentialsDst = path.join(mainDir, '.credentials.json');
        const credentialsTmp = `${credentialsDst}.tmp`;
        fs.copyFileSync(credentialsSrc, credentialsTmp);
        fs.renameSync(credentialsTmp, credentialsDst);
        const claudeJsonSrc = path.join(candidateDir, '.claude.json');
        if (fs.existsSync(claudeJsonSrc)) {
            const claudeJsonDst = path.join(mainDir, '.claude.json');
            const claudeJsonTmp = `${claudeJsonDst}.tmp`;
            fs.copyFileSync(claudeJsonSrc, claudeJsonTmp);
            fs.renameSync(claudeJsonTmp, claudeJsonDst);
        }
    }
    isNonWeeklyUnderThreshold(usages, threshold) {
        const nonWeekly = usages.filter((usage) => usage.hour !== this.weeklyWindowHours);
        const maxUtil = nonWeekly.length > 0
            ? Math.max(...nonWeekly.map((u) => u.utilizationPercentage))
            : 0;
        return maxUtil <= threshold;
    }
}
exports.OauthAPIClaudeMultiCandidateRepository = OauthAPIClaudeMultiCandidateRepository;
//# sourceMappingURL=OauthAPIClaudeMultiCandidateRepository.js.map