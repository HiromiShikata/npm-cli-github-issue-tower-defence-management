"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssignNoAssigneeIssueToManagerUseCase = void 0;
class AssignNoAssigneeIssueToManagerUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story ||
                input.cacheUsed ||
                !input.targetDates.find((targetDate) => targetDate.getMinutes() === 0)) {
                return;
            }
            const isTargetIssue = (issue) => {
                return (issue.story === null &&
                    (issue.nextActionDate === null ||
                        issue.nextActionDate.getTime() <= input.targetDates[0].getTime()) &&
                    issue.nextActionHour === null &&
                    issue.state === 'OPEN' &&
                    issue.story === null);
            };
            const firstStory = input.project.story?.stories[0];
            if (!firstStory) {
                return;
            }
            for (const issue of input.issues) {
                if (!isTargetIssue(issue)) {
                    continue;
                }
                await this.issueRepository.updateStory({ ...input.project, story }, issue, firstStory.id);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
    }
}
exports.AssignNoAssigneeIssueToManagerUseCase = AssignNoAssigneeIssueToManagerUseCase;
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.js.map