import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { encodeForURI } from './utils';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import { Member } from '../entities/Member';

export class ConvertCheckboxToIssueInStoryIssueUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      | 'createNewIssue'
      | 'updateIssue'
      | 'updateStory'
      | 'getIssueByUrl'
      | 'addIssueToProject'
    >,
  ) {}

  run = async (input: {
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    urlOfStoryView: string;
    storyObjectMap: StoryObjectMap;
    manager: Member['name'];
    createTaskFromStoryBodyCheckboxEnabled: boolean;
  }): Promise<void> => {
    const story = input.project.story;
    if (!story) {
      return;
    }

    for (const storyOption of input.project.story?.stories || []) {
      const storyIssue = input.issues.find((issue) =>
        storyOption.name.startsWith(issue.title),
      );
      const storyObject = input.storyObjectMap.get(storyOption.name);
      if (storyOption.name.startsWith('regular / ')) {
        continue;
      } else if (!storyIssue || !storyObject) {
        throw new Error(`Story issue not found: ${storyOption.name}`);
      } else if (storyIssue.isClosed) {
        continue;
      }
      const iced = storyIssue.status === ICEBOX_STATUS_NAME;
      if (
        iced &&
        this.bodyWithStoryViewLinkOnFirstLine(
          storyIssue.body,
          input.urlOfStoryView,
          storyOption.name,
        ) === storyIssue.body
      ) {
        continue;
      }
      const freshStoryIssue = await this.issueRepository.getIssueByUrl(
        storyIssue.url,
      );
      if (!freshStoryIssue) {
        console.warn(
          `ConvertCheckboxToIssueInStoryIssueUseCase: story issue not found by URL (possibly deleted), skipping story. storyIssueUrl: ${storyIssue.url}`,
        );
        continue;
      }
      let newBody = this.bodyWithStoryViewLinkOnFirstLine(
        freshStoryIssue.body,
        input.urlOfStoryView,
        storyOption.name,
      );
      if (newBody !== freshStoryIssue.body) {
        await this.issueRepository.updateIssue({
          ...freshStoryIssue,
          body: newBody,
        });
      }
      if (iced || !input.createTaskFromStoryBodyCheckboxEnabled) {
        continue;
      }
      if (!newBody.includes('- [ ] ')) {
        continue;
      }
      const checkboxTextsNotCreatedIssue =
        this.findCheckboxTextsNotCreatedIssue(newBody);
      for (const checkboxText of checkboxTextsNotCreatedIssue) {
        const issueTitle = checkboxText.replace(
          'STORYNAME',
          `${storyOption.name} #${freshStoryIssue.number}`,
        );
        const newIssueBody = `- Parent issue: ${freshStoryIssue.url}`;
        const newIssueNumber = await this.issueRepository.createNewIssue(
          freshStoryIssue.org,
          freshStoryIssue.repo,
          issueTitle,
          newIssueBody,
          [input.manager],
          [],
        );
        const newIssueUrl = `https://github.com/${freshStoryIssue.org}/${freshStoryIssue.repo}/issues/${newIssueNumber}`;
        newBody = newBody.replace(
          `- [ ] ${checkboxText}`,
          `- [ ] ${newIssueUrl}`,
        );
        await this.issueRepository.updateIssue({
          ...freshStoryIssue,
          body: newBody,
        });
        await this.issueRepository.addIssueToProject(
          input.project,
          newIssueUrl,
        );
        const newIssue = await this.issueRepository.getIssueByUrl(newIssueUrl);
        if (!newIssue) {
          throw new Error(`Issue not found: ${newIssueUrl}`);
        }
        await this.issueRepository.updateStory(
          { ...input.project, story: story },
          newIssue,
          storyOption.id,
        );
      }
    }
  };
  bodyWithStoryViewLinkOnFirstLine = (
    body: string,
    urlOfStoryView: string,
    storyName: string,
  ): string => {
    const storyViewLink = this.buildStoryViewLink(urlOfStoryView, storyName);
    const storyViewLinkPattern = this.buildStoryViewLinkPattern(
      urlOfStoryView,
      storyName,
    );
    const isStoryViewLinkLine = (line: string): boolean =>
      storyViewLinkPattern.test(line);
    const lines = body.split('\n');
    const remainingLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!isStoryViewLinkLine(lines[i])) {
        remainingLines.push(lines[i]);
        continue;
      }
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++;
        continue;
      }
      if (
        remainingLines.length > 0 &&
        remainingLines[remainingLines.length - 1].trim() === ''
      ) {
        remainingLines.pop();
      }
    }
    while (remainingLines.length > 0 && remainingLines[0].trim() === '') {
      remainingLines.shift();
    }
    return `${storyViewLink}\n\n${remainingLines.join('\n')}`;
  };
  buildStoryViewLink = (urlOfStoryView: string, storyName: string): string => {
    return `${urlOfStoryView}?sliceBy%5Bvalue%5D=${encodeForURI(storyName)}`;
  };
  buildStoryViewLinkPattern = (
    urlOfStoryView: string,
    storyName: string,
  ): RegExp => {
    const escapeForRegularExpression = (value: string): string =>
      value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const storyViewProjectUrl = urlOfStoryView.split('/views/')[0];
    const storySliceQuery = `?sliceBy%5Bvalue%5D=${encodeForURI(storyName)}`;
    return new RegExp(
      `${escapeForRegularExpression(storyViewProjectUrl)}(/views/\\d+)?${escapeForRegularExpression(storySliceQuery)}(?![\\w%])`,
    );
  };
  findCheckboxTextsNotCreatedIssue = (storyIssueBody: string): string[] => {
    const regexToFindCheckboxes = /^- \[ ] (.*)$/gm;
    const match = storyIssueBody.match(regexToFindCheckboxes);
    if (!match) return [];
    const checkboxes: string[] = [];
    for (let i = 0; i < match.length; i++) {
      checkboxes.push(match[i].replace('- [ ] ', '').trim());
    }
    return checkboxes.filter(
      (checkbox) =>
        checkbox !== '' &&
        !checkbox.match(/^https:\/\/github.com\/.*\/issues\/\d+$/) &&
        !checkbox.match(/^#\d+$/),
    );
  };
}
