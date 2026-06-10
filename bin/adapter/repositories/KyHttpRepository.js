"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KyHttpRepository = void 0;
const ky_1 = __importDefault(require("ky"));
class KyHttpRepository {
    constructor() {
        this.get = async (url) => {
            return ky_1.default.get(url).text();
        };
    }
}
exports.KyHttpRepository = KyHttpRepository;
//# sourceMappingURL=KyHttpRepository.js.map