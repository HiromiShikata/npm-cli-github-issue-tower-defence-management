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
            for (const issue of input.issues) {
                if (!this.isEligibleIssue(issue, input.targetDates)) {
                    continue;
                }
                const isWorkflowManagementIssue = issue.labels.includes(SetWorkflowManagementIssueToStoryUseCase.WORKFLOW_MANAGEMENT_LABEL) ||
                    issue.labels.includes(SetWorkflowManagementIssueToStoryUseCase.DAILY_ROUTINE_LABEL) ||
                    issue.isPr;
                if (isWorkflowManagementIssue) {
                    await this.issueRepository.updateStory({ ...input.project, story }, issue, story.workflowManagementStory.id);
                    const workflowLabel = issue.labels.find((label) => label.toLowerCase() ===
                        SetWorkflowManagementIssueToStoryUseCase.WORKFLOW_MANAGEMENT_LABEL);
                    if (workflowLabel) {
                        await this.issueRepository.removeLabel(issue, workflowLabel);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                    continue;
                }
                const storyLabel = issue.labels.find((label) => label
                    .toLowerCase()
                    .startsWith(SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX));
                if (!storyLabel) {
                    continue;
                }
                const labelSuffix = storyLabel.slice(SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX.length);
                const normalizedLabel = SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate(labelSuffix);
                const matchingStory = story.stories.find((s) => {
                    if (!s.name.startsWith(SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX)) {
                        return false;
                    }
                    const storySuffix = s.name.slice(SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX.length);
                    return (normalizedLabel ===
                        SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate(storySuffix));
                });
                if (!matchingStory) {
                    throw new Error(`No matching story found for label: ${storyLabel}`);
                }
                await this.issueRepository.updateStory({ ...input.project, story }, issue, matchingStory.id);
                await this.issueRepository.removeLabel(issue, storyLabel);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
        this.isEligibleIssue = (issue, targetDates) => {
            const hasStoryOrWorkflowTrigger = issue.labels.some((label) => label
                .toLowerCase()
                .startsWith(SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX)) ||
                issue.labels.includes(SetWorkflowManagementIssueToStoryUseCase.DAILY_ROUTINE_LABEL) ||
                issue.isPr;
            return (hasStoryOrWorkflowTrigger &&
                (issue.nextActionDate === null ||
                    issue.nextActionDate.getTime() <= targetDates[0].getTime()) &&
                issue.nextActionHour === null &&
                issue.state === 'OPEN' &&
                issue.story === null);
        };
    }
}
exports.SetWorkflowManagementIssueToStoryUseCase = SetWorkflowManagementIssueToStoryUseCase;
SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX = 'story:';
SetWorkflowManagementIssueToStoryUseCase.WORKFLOW_MANAGEMENT_LABEL = 'story:workflow-management';
SetWorkflowManagementIssueToStoryUseCase.DAILY_ROUTINE_LABEL = 'daily-routine';
SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX = 'regular / ';
SetWorkflowManagementIssueToStoryUseCase.normalizeCandidate = (candidate) => candidate.toLowerCase().replace(/[\s/_-]/g, '');
//# sourceMappingURL=SetWorkflowManagementIssueToStoryUseCase.js.map