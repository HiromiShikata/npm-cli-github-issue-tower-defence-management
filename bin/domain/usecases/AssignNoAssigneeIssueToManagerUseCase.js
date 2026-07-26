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
            const authorAllowList = input.autoAssignManagerAuthors &&
                input.autoAssignManagerAuthors.length > 0
                ? input.autoAssignManagerAuthors
                : null;
            for (const issue of input.issues) {
                if (issue.assignees.length > 0 || issue.state !== 'OPEN') {
                    continue;
                }
                if (authorAllowList !== null && !authorAllowList.includes(issue.author)) {
                    continue;
                }
                try {
                    await this.issueRepository.updateAssigneeList(issue, [input.manager]);
                }
                catch (e) {
                    if (!(e instanceof Error)) {
                        throw e;
                    }
                    console.error(`Failed to update assignee for issue ${issue.url}: ${e.message}`);
                    continue;
                }
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        };
    }
}
exports.AssignNoAssigneeIssueToManagerUseCase = AssignNoAssigneeIssueToManagerUseCase;
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.js.map