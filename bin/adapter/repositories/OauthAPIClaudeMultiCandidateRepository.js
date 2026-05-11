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
            const usages = await this.mainRepository.getUsage();
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
                if (this.isCandidateUnavailable(error)) {
                    continue;
                }
                throw error;
            }
            if (this.isNonWeeklyUnderThreshold(usages, threshold)) {
                fs.copyFileSync(path.join(candidateDir, '.credentials.json'), path.join(this.mainDir, '.credentials.json'));
                return true;
            }
        }
        return false;
    }
    async getUsage() {
        return this.mainRepository.getUsage();
    }
    isNonWeeklyUnderThreshold(usages, threshold) {
        const nonWeekly = usages.filter((usage) => usage.hour !== this.weeklyWindowHours);
        const maxUtil = nonWeekly.length > 0
            ? Math.max(...nonWeekly.map((u) => u.utilizationPercentage))
            : 0;
        return maxUtil <= threshold;
    }
    isCandidateUnavailable(error) {
        if (!(error instanceof Error))
            return false;
        return (error.message.includes('credentials file not found') ||
            error.message.startsWith('Claude API error:'));
    }
}
exports.OauthAPIClaudeMultiCandidateRepository = OauthAPIClaudeMultiCandidateRepository;
//# sourceMappingURL=OauthAPIClaudeMultiCandidateRepository.js.map