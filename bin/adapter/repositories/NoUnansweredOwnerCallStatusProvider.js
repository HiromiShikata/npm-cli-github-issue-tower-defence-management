"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoUnansweredOwnerCallStatusProvider = void 0;
class NoUnansweredOwnerCallStatusProvider {
    constructor() {
        this.listSessionNamesWithUnansweredOwnerCall = (_transcriptPathBySessionName) => {
            return Promise.resolve(new Set());
        };
    }
}
exports.NoUnansweredOwnerCallStatusProvider = NoUnansweredOwnerCallStatusProvider;
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.js.map