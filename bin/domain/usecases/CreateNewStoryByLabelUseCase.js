"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNewStoryByLabelUseCase = void 0;
class CreateNewStoryByLabelUseCase {
    constructor(projectRepository, issueRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const projectStory = input.project.story;
            if (!projectStory) {
                return;
            }
            const newStoryIssues = this.findNewStoryIssues(input.storyObjectMap, input.issues);
            if (newStoryIssues.length === 0) {
                return;
            }
            const newStoryList = this.createNewStoryList(projectStory, input.storyObjectMap, input.issues);
            const savedNewStoryList = await this.projectRepository.updateStoryList(input.project, newStoryList);
            for (const issue of newStoryIssues) {
                const linkedStory = savedNewStoryList.find((s) => s.name === issue.title);
                if (!linkedStory) {
                    continue;
                }
                await this.issueRepository.updateStory({ ...input.project, story: projectStory }, issue, linkedStory.id);
                await this.issueRepository.updateLabels(issue, issue.labels.filter((label) => label.toLowerCase().replace('-', '') !== 'newstory'));
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
            const newStoryList = [];
            if (projectStory.stories.length > 0) {
                newStoryList.push(projectStory.stories[0]);
            }
            newStoryList.push(...newStoryIssues.map((i) => ({
                id: null,
                name: i.title,
                color: 'RED',
                description: '',
            })));
            if (projectStory.stories.length > 1) {
                newStoryList.push(...projectStory.stories.slice(1, projectStory.stories.length));
            }
            return newStoryList;
        };
    }
}
exports.CreateNewStoryByLabelUseCase = CreateNewStoryByLabelUseCase;
//# sourceMappingURL=CreateNewStoryByLabelUseCase.js.map