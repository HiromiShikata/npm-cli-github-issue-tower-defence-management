"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleSubscriptionDisabledTokens = void 0;
const SubscriptionDisabledIssueUseCase_1 = require("../../../domain/usecases/SubscriptionDisabledIssueUseCase");
const TokenListLoader_1 = require("../../proxy/TokenListLoader");
const RateLimitCache_1 = require("../../proxy/RateLimitCache");
const handleSubscriptionDisabledTokens = async (params) => {
    const { tokenListJsonPath, org, repo, issueRepository } = params;
    if (tokenListJsonPath === null) {
        return;
    }
    const entries = (0, TokenListLoader_1.loadTokenEntries)(tokenListJsonPath);
    if (entries === null) {
        return;
    }
    const tokenEntries = entries.map((entry) => ({
        name: entry.name,
        subscriptionDisabled: (0, RateLimitCache_1.readRateLimit)(entry.token)?.subscriptionDisabled ?? false,
    }));
    await new SubscriptionDisabledIssueUseCase_1.SubscriptionDisabledIssueUseCase(issueRepository).run({
        tokenEntries,
        org,
        repo,
    });
};
exports.handleSubscriptionDisabledTokens = handleSubscriptionDisabledTokens;
//# sourceMappingURL=subscriptionDisabledTokenHandler.js.map