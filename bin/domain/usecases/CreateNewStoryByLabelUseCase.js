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
            const newStoryIssues = this.findNewStoryIssues(input.storyObjectMap);
            if (newStoryIssues.length === 0) {
                return;
            }
            const newStoryList = this.createNewStoryList(projectStory, input.storyObjectMap);
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
        this.findNewStoryIssues = (storyObjectMap) => {
            return Array.from(storyObjectMap.values())
                .flatMap((storyObject) => storyObject.issues)
                .filter((issue) => issue.labels?.some((label) => label.toLowerCase().replace('-', '') === 'newstory'));
        };
        this.createNewStoryList = (projectStory, storyObjectMap) => {
            const newStoryIssues = Array.from(storyObjectMap.values())
                .flatMap((storyObject) => storyObject.issues)
                .filter((issue) => issue.labels?.some((label) => label.toLowerCase().replace('-', '') === 'newstory'));
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
                newStoryList.push(...projectStory.stories.slice(1, projectStory.stories.length - 1));
            }
            return newStoryList;
        };
    }
}
exports.CreateNewStoryByLabelUseCase = CreateNewStoryByLabelUseCase;
//# sourceMappingURL=CreateNewStoryByLabelUseCase.js.map