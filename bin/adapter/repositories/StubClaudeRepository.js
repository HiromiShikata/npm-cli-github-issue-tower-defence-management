"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubClaudeRepository = void 0;
class StubClaudeRepository {
    async getUsage() {
        return [];
    }
    async isClaudeAvailable(_threshold) {
        return true;
    }
}
exports.StubClaudeRepository = StubClaudeRepository;
//# sourceMappingURL=StubClaudeRepository.js.map