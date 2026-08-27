"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNewStoryByLabelUseCase = void 0;
const Project_1 = require("../entities/Project");
const LOG_PREFIX = '[CreateNewStoryByLabel]';
class CreateNewStoryByLabelUseCase {
    constructor(projectRepository, issueRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const projectStory = input.project.story;
            if (!projectStory) {
                console.log(`${LOG_PREFIX} the project has no story field, so no labelled issue is evaluated. project=${input.project.url}`);
                return;
            }
            const newStoryIssues = this.findNewStoryIssues(input.storyObjectMap, input.issues);
            console.log(`${LOG_PREFIX} found ${newStoryIssues.length} issues carrying the new story label. project=${input.project.url}`);
            if (newStoryIssues.length === 0) {
                return;
            }
            console.log(`${LOG_PREFIX} labelled issues: ${newStoryIssues
                .map((issue) => issue.url)
                .join(', ')}`);
            const newStoryList = this.createNewStoryList(projectStory, input.storyObjectMap, input.issues);
            const addedStories = newStoryList.filter((story) => story.id === null);
            if (addedStories.length === 0) {
                console.log(`${LOG_PREFIX} every labelled issue title already names a story option, so the option list is left unchanged`);
            }
            else {
                console.log(`${LOG_PREFIX} submitting ${addedStories.length} new story options: ${addedStories
                    .map((story) => story.name)
                    .join(', ')}`);
            }
            const savedNewStoryList = addedStories.length === 0
                ? projectStory.stories
                : await this.projectRepository.updateStoryList(input.project, newStoryList);
            console.log(`${LOG_PREFIX} the story option list holds ${savedNewStoryList.length} options`);
            for (const issue of newStoryIssues) {
                const linkedStory = savedNewStoryList.find((s) => s.name === issue.title);
                if (!linkedStory) {
                    console.log(`${LOG_PREFIX} no story option matches the title of ${issue.url}, so it keeps the new story label`);
                    continue;
                }
                await this.issueRepository.updateStory({ ...input.project, story: projectStory }, issue, linkedStory.id);
                console.log(`${LOG_PREFIX} linked ${issue.url} to the story option ${linkedStory.id}`);
                await this.issueRepository.updateLabels(issue, issue.labels.filter((label) => label.toLowerCase().replace('-', '') !== 'newstory'));
                console.log(`${LOG_PREFIX} removed the new story label from ${issue.url}`);
            }
        };
        this.hasNewStoryLabel = (issue) => issue.labels?.some((label) => label.toLowerCase().replace('-', '') === 'newstory') ?? false;
        this.findNewStoryIssues = (storyObjectMap, issues) => {
            const issuesInMap = Array.from(storyObjectMap.values())
                .flatMap((storyObject) => storyObject.issues)
                .filter(this.hasNewStoryLabel);
            const unassignedIssuesWithLabel = issues
                .filter((issue) => issue.story === null)
                .filter(this.hasNewStoryLabel);
            const seen = new Set();
            return [...issuesInMap, ...unassignedIssuesWithLabel].filter((issue) => {
                if (seen.has(issue.url)) {
                    return false;
                }
                seen.add(issue.url);
                return true;
            });
        };
        this.createNewStoryList = (projectStory, storyObjectMap, issues) => {
            const newStoryIssues = this.findNewStoryIssues(storyObjectMap, issues);
            return [...newStoryIssues]
                .reverse()
                .reduce((acc, issue) => (0, Project_1.buildStoryListWithNew)(acc, issue.title), [...projectStory.stories]);
        };
    }
}
exports.CreateNewStoryByLabelUseCase = CreateNewStoryByLabelUseCase;
//# sourceMappingURL=CreateNewStoryByLabelUseCase.js.map