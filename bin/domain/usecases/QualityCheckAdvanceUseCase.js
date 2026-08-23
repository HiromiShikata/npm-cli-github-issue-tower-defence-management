"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityCheckAdvanceUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const issueReactivationTriggerIsPending_1 = require("./issueReactivationTriggerIsPending");
class QualityCheckAdvanceUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            const qualityCheckStatusName = params.awaitingQualityCheckStatusName ??
                WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME;
            const evaluatedAt = params.evaluatedAt ?? new Date();
            const doneStatusOption = params.project.status.statuses.find((s) => s.name === WorkflowStatus_1.DONE_STATUS_NAME);
            if (!doneStatusOption) {
                console.error(`Done status option '${WorkflowStatus_1.DONE_STATUS_NAME}' not found in project.`);
                return 0;
            }
            const issueUrlsWithMergedPr = new Set();
            for (const item of params.issues) {
                if (item.isPr && item.state === 'MERGED') {
                    for (const referencedIssueUrl of item.closingIssueReferenceUrls) {
                        issueUrlsWithMergedPr.add(referencedIssueUrl);
                    }
                }
            }
            const itemsToAdvance = params.issues.filter((issue) => issue.status === qualityCheckStatusName &&
                !issue.isClosed &&
                issue.dependedIssueUrls.length === 0 &&
                !(0, issueReactivationTriggerIsPending_1.issueReactivationTriggerIsPending)(issue, evaluatedAt) &&
                issueUrlsWithMergedPr.has(issue.url));
            let advancedCount = 0;
            const errors = [];
            for (const issue of itemsToAdvance) {
                try {
                    await this.issueRepository.updateStatus(params.project, issue, doneStatusOption.id);
                    advancedCount++;
                }
                catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length > 0) {
                throw new AggregateError(errors, `Failed to advance ${errors.length} issue(s) from ${qualityCheckStatusName} to ${WorkflowStatus_1.DONE_STATUS_NAME}`);
            }
            return advancedCount;
        };
    }
}
exports.QualityCheckAdvanceUseCase = QualityCheckAdvanceUseCase;
//# sourceMappingURL=QualityCheckAdvanceUseCase.js.map