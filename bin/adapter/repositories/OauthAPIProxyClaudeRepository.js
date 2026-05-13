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
exports.OauthAPIProxyClaudeRepository = void 0;
const OauthProxyClaudeRepository_1 = require("./OauthProxyClaudeRepository");
const OauthAPIClaudeRepository_1 = require("./OauthAPIClaudeRepository");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
class OauthAPIProxyClaudeRepository {
    constructor(proxyRepository = new OauthProxyClaudeRepository_1.OauthProxyClaudeRepository(), apiRepository = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository(path.join(os.homedir(), '.claude'))) {
        this.proxyRepository = proxyRepository;
        this.apiRepository = apiRepository;
    }
    async getUsage() {
        const proxyUsages = await this.proxyRepository.getUsage();
        if (proxyUsages.length > 0) {
            return proxyUsages;
        }
        return this.apiRepository.getUsage();
    }
    async isClaudeAvailable(threshold) {
        const proxyUsages = await this.proxyRepository.getUsage();
        if (proxyUsages.length > 0) {
            return proxyUsages.every((usage) => usage.utilizationPercentage < threshold);
        }
        return this.apiRepository.isClaudeAvailable(threshold);
    }
}
exports.OauthAPIProxyClaudeRepository = OauthAPIProxyClaudeRepository;
//# sourceMappingURL=OauthAPIProxyClaudeRepository.js.map