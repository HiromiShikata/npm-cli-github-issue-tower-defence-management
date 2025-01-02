"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzeStoriesUseCase = void 0;
const utils_1 = require("./utils");
class AnalyzeStoriesUseCase {
    constructor(issueRepository, dateRepository) {
        this.issueRepository = issueRepository;
        this.dateRepository = dateRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story ||
                !input.targetDates.find((targetDate) => targetDate.getHours() === 7 && targetDate.getMinutes() === 0)) {
                return;
            }
            const phases = new Map();
            phases.set('story:phase:requirement:opened', []);
            phases.set('story:phase:requirement:finished-prd', []);
            phases.set('story:phase:requirement:finished-figma', []);
            phases.set('story:phase:requirement:finished-testcase', []);
            phases.set('story:phase:requirement:finished-deviding-task', []);
            phases.set('story:phase:implementation-finished', []);
            phases.set('story:phase:finished-qa', []);
            phases.set('others', []);
            for (const story of input.project.story?.stories || []) {
                const storyIssue = input.issues.find((issue) => story.name.startsWith(issue.title));
                if (story.name.startsWith('regular / ')) {
                    continue;
                }
                else if (!storyIssue) {
                    throw new Error(`Story issue not found: ${story.name}`);
                }
                const storyIssueObject = {
                    ...storyIssue,
                    ...story,
                };
                if (storyIssue.status === input.disabledStatus) {
                    phases.get('others')?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:finished-qa')) {
                    phases.get('story:phase:finished-qa')?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:implementation-finished')) {
                    phases
                        .get('story:phase:implementation-finished')
                        ?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:requirement:finished-deviding-task')) {
                    phases
                        .get('story:phase:requirement:finished-deviding-task')
                        ?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:requirement:finished-testcase')) {
                    phases
                        .get('story:phase:requirement:finished-testcase')
                        ?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:requirement:finished-figma')) {
                    phases
                        .get('story:phase:requirement:finished-figma')
                        ?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:requirement:finished-prd')) {
                    phases
                        .get('story:phase:requirement:finished-prd')
                        ?.push(storyIssueObject);
                }
                else if (storyIssue.labels.includes('story:phase:requirement:opened')) {
                    phases.get('story:phase:requirement:opened')?.push(storyIssueObject);
                }
                else {
                    phases.get('others')?.push(storyIssueObject);
                }
            }
            await this.issueRepository.createNewIssue(input.org, input.repo, `Story progress`, this.createSummaryIssueBody(phases, input.urlOfStoryView), [input.manager], ['story:workflow-management']);
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
exports.AnalyzeStoriesUseCase = AnalyzeStoriesUseCase;
//# sourceMappingURL=AnalyzeStoriesUseCase.js.map