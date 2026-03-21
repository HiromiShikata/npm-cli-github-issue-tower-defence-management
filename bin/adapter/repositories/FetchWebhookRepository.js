"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchWebhookRepository = void 0;
class FetchWebhookRepository {
    async sendGetRequest(url) {
        await fetch(url);
    }
}
exports.FetchWebhookRepository = FetchWebhookRepository;
//# sourceMappingURL=FetchWebhookRepository.js.map