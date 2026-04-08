"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignNoAssigneeIssueToManagerUseCase = void 0;
class AssignNoAssigneeIssueToManagerUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            if (input.cacheUsed) {
                return;
            }
            for (const issue of input.issues) {
                if (issue.assignees.length > 0 || issue.state !== 'OPEN') {
                    continue;
                }
                try {
                    await this.issueRepository.updateAssigneeList(issue, [input.manager]);
                }
                catch (e) {
                    if (!(e instanceof Error)) {
                        throw e;
                    }
                    throw new Error(`Failed to update assignee for issue ${issue.url}: ${e.message}`);
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        };
    }
}
exports.AssignNoAssigneeIssueToManagerUseCase = AssignNoAssigneeIssueToManagerUseCase;
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.js.map