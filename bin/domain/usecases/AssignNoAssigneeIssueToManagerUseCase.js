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
                    console.warn(`Failed to assign ${input.manager} to ${issue.org}/${issue.repo}#${issue.number}: ${e instanceof Error ? e.message : String(e)}`);
                    continue;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        };
    }
}
exports.AssignNoAssigneeIssueToManagerUseCase = AssignNoAssigneeIssueToManagerUseCase;
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.js.map