"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConvertCheckboxToIssueInStoryIssueUseCase = void 0;
const utils_1 = require("./utils");
const WorkflowStatus_1 = require("../entities/WorkflowStatus");
class ConvertCheckboxToIssueInStoryIssueUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const story = input.project.story;
            if (!story) {
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
                    storyIssue.status === WorkflowStatus_1.ICEBOX_STATUS_NAME) {
                    continue;
                }
                const freshStoryIssue = await this.issueRepository.getIssueByUrl(storyIssue.url);
                if (!freshStoryIssue) {
                    throw new Error(`Story issue not found by URL: ${storyIssue.url}`);
                }
                const storyViewLink = this.buildStoryViewLink(input.urlOfStoryView, storyOption.name);
                let newBody = freshStoryIssue.body;
                if (!freshStoryIssue.body.includes(storyViewLink)) {
                    newBody = `${storyViewLink}\n\n${newBody}`;
                    await this.issueRepository.updateIssue({
                        ...freshStoryIssue,
                        body: newBody,
                    });
                }
                if (!newBody.includes('- [ ] ')) {
                    continue;
                }
                const checkboxTextsNotCreatedIssue = this.findCheckboxTextsNotCreatedIssue(newBody);
                for (const checkboxText of checkboxTextsNotCreatedIssue) {
                    const issueTitle = checkboxText.replace('STORYNAME', `${storyOption.name} #${freshStoryIssue.number}`);
                    const newIssueBody = `- Parent issue: ${freshStoryIssue.url}`;
                    const newIssueNumber = await this.issueRepository.createNewIssue(freshStoryIssue.org, freshStoryIssue.repo, issueTitle, newIssueBody, [input.manager], []);
                    const newIssueUrl = `https://github.com/${freshStoryIssue.org}/${freshStoryIssue.repo}/issues/${newIssueNumber}`;
                    newBody = newBody.replace(`- [ ] ${checkboxText}`, `- [ ] ${newIssueUrl}`);
                    await this.issueRepository.updateIssue({
                        ...freshStoryIssue,
                        body: newBody,
                    });
                    await this.issueRepository.addIssueToProject(input.project, newIssueUrl);
                    const newIssue = await this.issueRepository.getIssueByUrl(newIssueUrl);
                    if (!newIssue) {
                        throw new Error(`Issue not found: ${newIssueUrl}`);
                    }
                    await this.issueRepository.updateStory({ ...input.project, story: story }, newIssue, storyOption.id);
                }
            }
        };
        this.buildStoryViewLink = (urlOfStoryView, storyName) => {
            return `${urlOfStoryView}?sliceBy%5Bvalue%5D=${(0, utils_1.encodeForURI)(storyName)}`;
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