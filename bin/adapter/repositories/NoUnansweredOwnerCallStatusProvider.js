"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoUnansweredOwnerCallStatusProvider = void 0;
class NoUnansweredOwnerCallStatusProvider {
    constructor() {
        this.listSessionNamesWithUnansweredOwnerCall = (_sessionNames) => {
            return Promise.resolve(new Set());
        };
    }
}
exports.NoUnansweredOwnerCallStatusProvider = NoUnansweredOwnerCallStatusProvider;
//# sourceMappingURL=NoUnansweredOwnerCallStatusProvider.js.map