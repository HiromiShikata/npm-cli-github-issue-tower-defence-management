"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetWorkflowManagementIssueToStoryUseCase = void 0;
class SetWorkflowManagementIssueToStoryUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story || input.cacheUsed) {
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
                    await this.notifyUnmatchedStoryLabel(issue, storyLabel, labelSuffix);
                    continue;
                }
                await this.issueRepository.updateStory({ ...input.project, story }, issue, matchingStory.id);
                await this.issueRepository.removeLabel(issue, storyLabel);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        };
        this.notifyUnmatchedStoryLabel = async (issue, storyLabel, labelSuffix) => {
            const title = SetWorkflowManagementIssueToStoryUseCase.buildUnmatchedStoryLabelTitle(storyLabel, labelSuffix);
            const existingOpenIssues = await this.issueRepository.searchIssue({
                owner: issue.org,
                repositoryName: issue.repo,
                type: 'issue',
                state: 'open',
                title,
            });
            const alreadyNotified = existingOpenIssues.some((existing) => existing.title === title);
            if (alreadyNotified) {
                return;
            }
            const body = this.buildUnmatchedStoryLabelBody(issue, storyLabel);
            await this.issueRepository.createNewIssue(issue.org, issue.repo, title, body, [issue.org], []);
        };
        this.buildUnmatchedStoryLabelBody = (issue, storyLabel) => {
            const labelSuffix = storyLabel.slice(SetWorkflowManagementIssueToStoryUseCase.STORY_LABEL_PREFIX.length);
            return [
                'From: :robot: SetWorkflowManagementIssueToStoryUseCase',
                '',
                `The issue below carries the label \`${storyLabel}\`, but the project has no matching \`${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}\` Story option.`,
                '',
                issue.url,
                '',
                `Because no matching \`${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}\` Story option exists, the label cannot be auto-converted to a Story.`,
                'Add the missing Story option to the project, or correct the label on the issue above, to resolve this.',
            ].join('\n');
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
SetWorkflowManagementIssueToStoryUseCase.buildUnmatchedStoryLabelTitle = (storyLabel, labelSuffix) => `TDPM: story label "${storyLabel}" has no matching "${SetWorkflowManagementIssueToStoryUseCase.REGULAR_STORY_PREFIX}${labelSuffix}" Story option`;
//# sourceMappingURL=SetWorkflowManagementIssueToStoryUseCase.js.map