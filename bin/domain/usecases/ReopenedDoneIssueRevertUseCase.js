"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReopenedDoneIssueRevertUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class ReopenedDoneIssueRevertUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            const awaitingWorkspaceStatusOption = params.project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatusOption) {
                console.error(`Awaiting Workspace status option '${WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME}' not found in project.`);
                return 0;
            }
            const itemsToRevert = params.issues.filter((issue) => issue.status === WorkflowStatus_1.DONE_STATUS_NAME &&
                issue.stateReason === 'REOPENED' &&
                !issue.isPr);
            let revertedCount = 0;
            const errors = [];
            for (const issue of itemsToRevert) {
                try {
                    await this.issueRepository.updateStatus(params.project, issue, awaitingWorkspaceStatusOption.id);
                    revertedCount++;
                }
                catch (error) {
                    errors.push(error);
                }
            }
            if (errors.length > 0) {
                throw new AggregateError(errors, `Failed to revert ${errors.length} issue(s) from ${WorkflowStatus_1.DONE_STATUS_NAME} to ${WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME}`);
            }
            return revertedCount;
        };
    }
}
exports.ReopenedDoneIssueRevertUseCase = ReopenedDoneIssueRevertUseCase;
//# sourceMappingURL=ReopenedDoneIssueRevertUseCase.js.map