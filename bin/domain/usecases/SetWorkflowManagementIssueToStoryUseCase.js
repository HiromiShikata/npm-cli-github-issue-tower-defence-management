"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetWorkflowManagementIssueToStoryUseCase = void 0;
class SetWorkflowManagementIssueToStoryUseCase {
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
                return ((issue.labels.includes('story:workflow-management') ||
                    issue.labels.includes('daily-routine') ||
                    issue.isPr) &&
                    (issue.nextActionDate === null ||
                        issue.nextActionDate.getTime() <= input.targetDates[0].getTime()) &&
                    issue.nextActionHour === null &&
                    issue.state === 'OPEN' &&
                    issue.story === null);
            };
            for (const issue of input.issues) {
                if (!isTargetIssue(issue)) {
                    continue;
                }
                await this.issueRepository.updateStory({ ...input.project, story }, issue, story.workflowManagementStory.id);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
    }
}
exports.SetWorkflowManagementIssueToStoryUseCase = SetWorkflowManagementIssueToStoryUseCase;
//# sourceMappingURL=SetWorkflowManagementIssueToStoryUseCase.js.map