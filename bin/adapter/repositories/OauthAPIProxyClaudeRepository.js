"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OauthAPIProxyClaudeRepository = void 0;
const OauthProxyClaudeRepository_1 = require("./OauthProxyClaudeRepository");
const OauthAPIClaudeRepository_1 = require("./OauthAPIClaudeRepository");
class OauthAPIProxyClaudeRepository {
    constructor(proxyRepository = new OauthProxyClaudeRepository_1.OauthProxyClaudeRepository(), apiRepository = new OauthAPIClaudeRepository_1.OauthAPIClaudeRepository()) {
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