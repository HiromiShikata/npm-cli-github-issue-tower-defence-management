"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenerateDashboardRowUseCase = void 0;
const WorkflowStatus_1 = require("../../entities/WorkflowStatus");
const WORKFLOW_BLOCKER_STORY_MARKER = 'workflow blocker';
class GenerateDashboardRowUseCase {
    constructor() {
        this.run = (input) => {
            const { issues, assigneeLogin } = input;
            const mine = (issue) => issue.isClosed === false && issue.assignees.includes(assigneeLogin);
            const actionable = (issue) => mine(issue) &&
                issue.dependedIssueUrls.length === 0 &&
                issue.nextActionDate === null &&
                issue.nextActionHour === null;
            const countActionableWithStatus = (statusName) => issues.filter((issue) => issue.status === statusName && actionable(issue))
                .length;
            const countMineWithStatus = (statusName) => issues.filter((issue) => mine(issue) && issue.status === statusName)
                .length;
            return {
                unread: countActionableWithStatus(WorkflowStatus_1.DEFAULT_STATUS_NAME),
                todo: countActionableWithStatus(WorkflowStatus_1.TODO_STATUS_NAME),
                qc: countActionableWithStatus(WorkflowStatus_1.AWAITING_QUALITY_CHECK_STATUS_NAME),
                fail: countMineWithStatus(WorkflowStatus_1.FAILED_PREPARATION_STATUS_NAME),
                pr: countMineWithStatus(WorkflowStatus_1.PREPARATION_STATUS_NAME),
                ws: countActionableWithStatus(WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME),
                dep: issues.filter((issue) => mine(issue) &&
                    issue.status === WorkflowStatus_1.AWAITING_WORKSPACE_STATUS_NAME &&
                    issue.dependedIssueUrls.length > 0).length,
                blocker: issues.filter((issue) => mine(issue) &&
                    (issue.story ?? '')
                        .toLowerCase()
                        .includes(WORKFLOW_BLOCKER_STORY_MARKER)).length,
            };
        };
    }
}
exports.GenerateDashboardRowUseCase = GenerateDashboardRowUseCase;
//# sourceMappingURL=GenerateDashboardRowUseCase.js.map