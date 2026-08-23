"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueReactivationTriggerIsPending = exports.issueReactivationTriggerStartOfTomorrow = void 0;
const issueReactivationTriggerStartOfTomorrow = (evaluatedAt) => new Date(evaluatedAt.getFullYear(), evaluatedAt.getMonth(), evaluatedAt.getDate() + 1);
exports.issueReactivationTriggerStartOfTomorrow = issueReactivationTriggerStartOfTomorrow;
const issueReactivationTriggerIsPending = (issue, evaluatedAt) => {
    const startOfTomorrow = (0, exports.issueReactivationTriggerStartOfTomorrow)(evaluatedAt);
    const hasFutureNextActionDate = issue.nextActionDate !== null && issue.nextActionDate >= startOfTomorrow;
    const hasUnreachedNextActionHour = issue.nextActionHour !== null &&
        evaluatedAt.getHours() < issue.nextActionHour;
    return hasFutureNextActionDate || hasUnreachedNextActionHour;
};
exports.issueReactivationTriggerIsPending = issueReactivationTriggerIsPending;
//# sourceMappingURL=issueReactivationTriggerIsPending.js.map