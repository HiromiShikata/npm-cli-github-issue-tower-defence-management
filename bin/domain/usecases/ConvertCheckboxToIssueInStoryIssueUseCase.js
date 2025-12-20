"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvertCheckboxToIssueInStoryIssueUseCase = void 0;
class ConvertCheckboxToIssueInStoryIssueUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story || input.cacheUsed) {
                return;
            }
            for (const storyOption of input.project.story?.stories || []) {
                const storyIssue = input.issues.find((issue) => storyOption.name.startsWith(issue.title));
                const storyObject = input.storyObjectMap.get(storyOption.name);
                if (storyOption.name.startsWith('regular / ')) {
                    continue;
                }
                else if (!storyIssue || !storyObject) {
                    throw new Error(`Story issue not found: ${storyOption.name}`);
                }
                else if (storyIssue.isClosed ||
                    storyIssue.status === input.disabledStatus) {
                    continue;
                }
                else if (!storyIssue.body.includes('- [ ] ')) {
                    continue;
                }
                const checkboxTextsNotCreatedIssue = this.findCheckboxTextsNotCreatedIssue(storyIssue.body);
                let newBody = storyIssue.body;
                for (const checkboxText of checkboxTextsNotCreatedIssue) {
                    const issueTitle = checkboxText.replace('STORYNAME', `${storyOption.name} #${storyIssue.number}`);
                    const newIssueNumber = await this.issueRepository.createNewIssue(input.org, input.repo, issueTitle, '', [], []);
                    const newIssueUrl = `https://github.com/${input.org}/${input.repo}/issues/${newIssueNumber}`;
                    newBody = newBody.replace(`- [ ] ${checkboxText}`, `- [ ] ${newIssueUrl}`);
                    await this.issueRepository.updateIssue({
                        ...storyIssue,
                        body: newBody,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 30 * 1000));
                    const newIssue = await this.issueRepository.getIssueByUrl(newIssueUrl);
                    if (!newIssue) {
                        throw new Error(`Issue not found: ${newIssueUrl}`);
                    }
                    await this.issueRepository.updateStory({ ...input.project, story: story }, newIssue, storyOption.id);
                }
            }
        };
        this.findCheckboxTextsNotCreatedIssue = (storyIssueBody) => {
            const regexToFindCheckboxes = /^- \[ ] (.*)$/gm;
            const match = storyIssueBody.match(regexToFindCheckboxes);
            if (!match)
                return [];
            const checkboxes = [];
            for (let i = 0; i < match.length; i++) {
                checkboxes.push(match[i].replace('- [ ] ', '').trim());
            }
            return checkboxes.filter((checkbox) => checkbox !== '' &&
                !checkbox.match(/^https:\/\/github.com\/.*\/issues\/\d+$/) &&
                !checkbox.match(/^#\d+$/));
        };
    }
}
exports.ConvertCheckboxToIssueInStoryIssueUseCase = ConvertCheckboxToIssueInStoryIssueUseCase;
//# sourceMappingURL=ConvertCheckboxToIssueInStoryIssueUseCase.js.map