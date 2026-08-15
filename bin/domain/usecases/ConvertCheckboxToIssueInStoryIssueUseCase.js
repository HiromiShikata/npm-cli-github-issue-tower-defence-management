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
                const storyIssue = input.issues
                    .filter((issue) => storyOption.name.startsWith(issue.title))
                    .reduce((longest, issue) => longest === null || issue.title.length > longest.title.length
                    ? issue
                    : longest, null);
                const storyObject = input.storyObjectMap.get(storyOption.name);
                if (storyOption.name.startsWith('regular / ')) {
                    continue;
                }
                else if (!storyIssue || !storyObject) {
                    throw new Error(`Story issue not found: ${storyOption.name}`);
                }
                else if (storyIssue.isClosed) {
                    continue;
                }
                const iced = storyIssue.status === WorkflowStatus_1.ICEBOX_STATUS_NAME;
                const noCheckboxWorkFollows = iced || !input.createTaskFromStoryBodyCheckboxEnabled;
                const storyViewLinkAlreadyOnFirstLine = this.bodyWithStoryViewLinkOnFirstLine(storyIssue.body, input.urlOfStoryView, storyOption.name) === storyIssue.body;
                if (noCheckboxWorkFollows && storyViewLinkAlreadyOnFirstLine) {
                    continue;
                }
                const freshStoryBody = await this.issueRepository.getIssueBodyByUrl(storyIssue.url);
                if (freshStoryBody === null) {
                    console.warn(`ConvertCheckboxToIssueInStoryIssueUseCase: story issue not found by URL (possibly deleted), skipping story. storyIssueUrl: ${storyIssue.url}`);
                    continue;
                }
                let newBody = this.bodyWithStoryViewLinkOnFirstLine(freshStoryBody, input.urlOfStoryView, storyOption.name);
                if (newBody !== freshStoryBody) {
                    await this.issueRepository.updateIssueBody(storyIssue, newBody);
                }
                if (iced || !input.createTaskFromStoryBodyCheckboxEnabled) {
                    continue;
                }
                if (!newBody.includes('- [ ] ')) {
                    continue;
                }
                const checkboxTextsNotCreatedIssue = this.findCheckboxTextsNotCreatedIssue(newBody);
                for (const checkboxText of checkboxTextsNotCreatedIssue) {
                    const issueTitle = checkboxText.replace('STORYNAME', `${storyOption.name} #${storyIssue.number}`);
                    const newIssueBody = `- Parent issue: ${storyIssue.url}`;
                    const newIssueNumber = await this.issueRepository.createNewIssue(storyIssue.org, storyIssue.repo, issueTitle, newIssueBody, [input.manager], []);
                    const newIssueUrl = `https://github.com/${storyIssue.org}/${storyIssue.repo}/issues/${newIssueNumber}`;
                    newBody = newBody.replace(`- [ ] ${checkboxText}`, `- [ ] ${newIssueUrl}`);
                    await this.issueRepository.updateIssueBody(storyIssue, newBody);
                    await this.issueRepository.addIssueToProject(input.project, newIssueUrl);
                    const newIssue = await this.issueRepository.getIssueByUrl(newIssueUrl);
                    if (!newIssue) {
                        throw new Error(`Issue not found: ${newIssueUrl}`);
                    }
                    await this.issueRepository.updateStory({ ...input.project, story: story }, newIssue, storyOption.id);
                }
            }
        };
        this.bodyWithStoryViewLinkOnFirstLine = (body, urlOfStoryView, storyName) => {
            const storyViewLink = this.buildStoryViewLink(urlOfStoryView, storyName);
            const storyViewLinkPattern = this.buildStoryViewLinkPattern(urlOfStoryView, storyName);
            const isStoryViewLinkLine = (line) => storyViewLinkPattern.test(line);
            const lines = body.split('\n');
            const remainingLines = [];
            for (let i = 0; i < lines.length; i++) {
                if (!isStoryViewLinkLine(lines[i])) {
                    remainingLines.push(lines[i]);
                    continue;
                }
                if (i + 1 < lines.length && lines[i + 1].trim() === '') {
                    i++;
                    continue;
                }
                if (remainingLines.length > 0 &&
                    remainingLines[remainingLines.length - 1].trim() === '') {
                    remainingLines.pop();
                }
            }
            while (remainingLines.length > 0 && remainingLines[0].trim() === '') {
                remainingLines.shift();
            }
            return `${storyViewLink}\n\n${remainingLines.join('\n')}`;
        };
        this.buildStoryViewLink = (urlOfStoryView, storyName) => {
            return `${urlOfStoryView}?sliceBy%5Bvalue%5D=${(0, utils_1.encodeForURI)(storyName)}`;
        };
        this.buildStoryViewLinkPattern = (urlOfStoryView, storyName) => {
            const escapeForRegularExpression = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const storyViewProjectUrl = urlOfStoryView.split('/views/')[0];
            const storySliceQuery = `?sliceBy%5Bvalue%5D=${(0, utils_1.encodeForURI)(storyName)}`;
            return new RegExp(`${escapeForRegularExpression(storyViewProjectUrl)}(/views/\\d+)?${escapeForRegularExpression(storySliceQuery)}(?![\\w%])`);
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