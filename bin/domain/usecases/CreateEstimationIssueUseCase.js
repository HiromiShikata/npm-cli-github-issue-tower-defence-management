"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateEstimationIssueUseCase = void 0;
const utils_1 = require("./utils");
class CreateEstimationIssueUseCase {
    constructor(issueRepository, dateRepository) {
        this.issueRepository = issueRepository;
        this.dateRepository = dateRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story ||
                !input.targetDates.find((targetDate) => targetDate.getHours() === 7 && targetDate.getMinutes() === 0)) {
                return;
            }
            for (const story of input.project.story?.stories || []) {
                const storyIssue = input.issues.find((issue) => story.name.startsWith(issue.title));
                const storyObject = input.storyObjectMap.get(story.name);
                if (story.name.startsWith('regular / ')) {
                    continue;
                }
                else if (!storyIssue || !storyObject) {
                    throw new Error(`Story issue not found: ${story.name}`);
                }
                else if (!storyIssue.labels.includes('story:action:schedule-control')) {
                    continue;
                }
                const assignees = new Set();
                for (const issueInStory of storyObject.issues) {
                    if (issueInStory.isClosed ||
                        issueInStory.isPr ||
                        issueInStory.labels.includes('story') ||
                        issueInStory.status === input.disabledStatus) {
                        continue;
                    }
                    for (const assignee of issueInStory.assignees) {
                        assignees.add(assignee);
                    }
                }
                for (const assignee of assignees) {
                    await this.issueRepository.createNewIssue(input.org, input.repo, `Put estimation fields of \`${story.name}\` for ${assignee} :pray:`, this.createEstimationIssueBody({ storyIssue, issues: storyObject.issues }, input.urlOfStoryView, input.project), [assignee], ['story:workflow-management']);
                    await new Promise((resolve) => setTimeout(resolve, 5000));
                }
            }
        };
        this.createEstimationIssueBody = (storyObject, urlObStoryView, project) => {
            return `
This issue is experimental workflow :pray:
- Target story: ${storyObject.storyIssue.url}

## Tasks
- [ ] 1. Fill \`50% confidence completion date\` to all issues on ${urlObStoryView}?filterQuery=story%3A%22${(0, utils_1.encodeForURI)(storyObject.storyIssue.story)}%22+is%3Aopen+no%3A%22${(0, utils_1.encodeForURI)(project.completionDate50PercentConfidence?.name)}%22+assignee%3A%40me
- [ ] 2. Fill \`Remaining Estimation (minutes)\` to all issues on ${urlObStoryView}?filterQuery=story%3A%22${(0, utils_1.encodeForURI)(storyObject.storyIssue.story)}%22+is%3Aopen+no%3A%22${(0, utils_1.encodeForURI)(project.remainingEstimationMinutes?.name)}%22+assignee%3A%40me
- [ ] 3. Take screenshot and comment to this issue about ${urlObStoryView}?filterQuery=story%3A%22${(0, utils_1.encodeForURI)(storyObject.storyIssue.story)}%22+is%3Aopen+assignee%3A%40me
- [ ] 4. Close

⚡⚡⚡
Dont forget, it's just 50% confidence :pray:
This is the date you think you have a 50-50 chance of completing the task. Think of it as "if everything goes normally (not best-case, not worst-case), when would this be done?"

Important: You will NOT be held accountable if you miss this date. We're using this for project planning, not for performance evaluation. We manage delays and risks at the project level with buffers.

Please give your honest estimate without adding any "just in case" padding. Focus only on the actual work time needed, assuming things go smoothly but not perfectly.

That's all! Let me know if you have any questions.
⚡⚡⚡
`;
        };
        this.createSummaryIssueBody = (summaryStoryIssue, urlOfStoryView) => {
            return `

${Array.from(summaryStoryIssue.keys())
                .map((key) => {
                return `
## ${key}
${summaryStoryIssue
                    .get(key)
                    ?.map((issue) => {
                    const storyColor = `:${issue.color === 'BLUE' ? 'large_' : ''}${issue.color === 'GRAY' ? 'black' : issue.color === 'PINK' ? 'red' : issue.color.toLowerCase()}_circle:`;
                    const stakeHolder = issue.labels.find((label) => label === 'story:stakeholder:user')
                        ? `:bust_in_silhouette:`
                        : issue.labels.find((label) => label === 'story:stakeholder:engineer')
                            ? `:gear:`
                            : issue.labels.find((label) => label === 'story:stakeholder:cs-team')
                                ? `:headphones:`
                                : issue.labels.find((label) => label === 'story:stakeholder:potential-user')
                                    ? ':busts_in_silhouette:'
                                    : issue.labels.find((label) => label === 'story:stakeholder:sales-team')
                                        ? ':briefcase:'
                                        : ':question:';
                    const boardUrl = `${urlOfStoryView}?filterQuery=story%3A%22${(0, utils_1.encodeForURI)(issue.story)}%22+is%3Aopen`;
                    return `- ${storyColor} ${stakeHolder} ${issue.url} [:memo:](${boardUrl})`;
                })
                    .join('\n')}`;
            })
                .join('\n')}`;
        };
    }
}
exports.CreateEstimationIssueUseCase = CreateEstimationIssueUseCase;
//# sourceMappingURL=CreateEstimationIssueUseCase.js.map