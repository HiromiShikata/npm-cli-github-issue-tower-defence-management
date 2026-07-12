"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoUnansweredOwnerCallStatusProvider = void 0;
class NoUnansweredOwnerCallStatusProvider {
    constructor() {
        this.listUnansweredOwnerCallEpochSecondsBySessionName = (_transcriptPathBySessionName) => {
            return Promise.resolve(new Map());
        };
    }
}
exports.NoUnansweredOwnerCallStatusProvider = NoUnansweredOwnerCallStatusProvider;
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.js.map