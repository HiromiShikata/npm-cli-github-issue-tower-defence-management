"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FetchWebhookRepository = void 0;
const ky_1 = __importDefault(require("ky"));
class FetchWebhookRepository {
    async sendGetRequest(url) {
        await ky_1.default.get(url);
    }
}
exports.FetchWebhookRepository = FetchWebhookRepository;
//# sourceMappingURL=FetchWebhookRepository.js.map