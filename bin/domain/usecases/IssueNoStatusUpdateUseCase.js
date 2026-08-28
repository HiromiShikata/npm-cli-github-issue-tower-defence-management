"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueNoStatusUpdateUseCase = void 0;
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
const isArchivedProjectItemError = (error) => {
    const message = error instanceof Error ? error.message : String(error);
    return message.toLowerCase().includes('archived');
};
class IssueNoStatusUpdateUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const awaitingWorkspaceStatus = input.project.status.statuses.find((s) => s.name === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME);
            if (!awaitingWorkspaceStatus) {
                return;
            }
            for (const issue of input.issues) {
                if (issue.isClosed || issue.status !== null) {
                    continue;
                }
                try {
                    await this.issueRepository.updateStatus(input.project, issue, awaitingWorkspaceStatus.id);
                }
                catch (error) {
                    if (isArchivedProjectItemError(error)) {
                        console.warn(`IssueNoStatusUpdateUseCase: project item is archived and cannot be updated, skipping. issueUrl: ${issue.url}`);
                        continue;
                    }
                    throw error;
                }
            }
        };
    }
}
exports.IssueNoStatusUpdateUseCase = IssueNoStatusUpdateUseCase;
//# sourceMappingURL=IssueNoStatusUpdateUseCase.js.map