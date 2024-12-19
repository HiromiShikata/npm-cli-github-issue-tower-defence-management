import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';

export class AnalyzeStoriesUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue'>,
    readonly dateRepository: Pick<DateRepository, 'formatDurationToHHMM'>,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    manager: Member['name'];
    org: string;
    repo: string;
    urlOfStoryView: string;
    disabledStatus: string;
    storyObjectMap: StoryObjectMap;
  }): Promise<void> => {
    const story = input.project.story;
    if (!story) {
      return;
    }
    const phases = new Map<
      string,
      (Issue & {
        name: string;
        color: string;
        description: string;
      })[]
    >();

    phases.set('story:phase:requirement:opened', []);
    phases.set('story:phase:requirement:finished-prd', []);
    phases.set('story:phase:requirement:finished-figma', []);
    phases.set('story:phase:requirement:finished-testcase', []);
    phases.set('story:phase:requirement:finished-deviding-task', []);
    phases.set('story:phase:implementation-finished', []);
    phases.set('story:phase:finished-qa', []);
    phases.set('others', []);

    for (const story of input.project.story?.stories || []) {
      const storyIssue = input.issues.find((issue) =>
        story.name.startsWith(issue.title),
      );
      if (story.name.startsWith('regular / ')) {
        continue;
      } else if (!storyIssue) {
        throw new Error(`Story issue not found: ${story.name}`);
      }
      const storyIssueObject = {
        ...storyIssue,
        ...story,
      };

      if (storyIssue.status === input.disabledStatus) {
        phases.get('others')?.push(storyIssueObject);
      } else if (storyIssue.labels.includes('story:phase:finished-qa')) {
        phases.get('story:phase:finished-qa')?.push(storyIssueObject);
      } else if (
        storyIssue.labels.includes('story:phase:implementation-finished')
      ) {
        phases
          .get('story:phase:implementation-finished')
          ?.push(storyIssueObject);
      } else if (
        storyIssue.labels.includes(
          'story:phase:requirement:finished-deviding-task',
        )
      ) {
        phases
          .get('story:phase:requirement:finished-deviding-task')
          ?.push(storyIssueObject);
      } else if (
        storyIssue.labels.includes('story:phase:requirement:finished-testcase')
      ) {
        phases
          .get('story:phase:requirement:finished-testcase')
          ?.push(storyIssueObject);
      } else if (
        storyIssue.labels.includes('story:phase:requirement:finished-figma')
      ) {
        phases
          .get('story:phase:requirement:finished-figma')
          ?.push(storyIssueObject);
      } else if (
        storyIssue.labels.includes('story:phase:requirement:finished-prd')
      ) {
        phases
          .get('story:phase:requirement:finished-prd')
          ?.push(storyIssueObject);
      } else if (storyIssue.labels.includes('story:phase:requirement:opened')) {
        phases.get('story:phase:requirement:opened')?.push(storyIssueObject);
      } else {
        console.log('unhandled story', storyIssueObject);
      }
    }
    await this.issueRepository.createNewIssue(
      input.org,
      input.repo,
      `Story progress`,
      this.createSummaryIssueBody(phases, input.urlOfStoryView),
      [input.manager],
      ['story:workflow-management'],
    );
  };
  createSummaryIssueBody = (
    summaryStoryIssue: Map<
      string,
      (Issue & {
        name: string;
        color: string;
        description: string;
      })[]
    >,
    urlOfStoryView: string,
  ): string => {
    return `

${Array.from(summaryStoryIssue.keys())
  .map((key) => {
    return `
## ${key}
${summaryStoryIssue
  .get(key)
  ?.map((issue) => {
    const storyColor = `:${issue.color === 'BLUE' ? 'large_' : ''}${issue.color === 'GRAY' ? 'black' : issue.color.toLowerCase()}_circle:`;
    const stakeHolder = issue.labels.find(
      (label) => label === 'story:stakeholder:user',
    )
      ? `:bust_in_silhouette:`
      : issue.labels.find((label) => label === 'story:stakeholder:engineer')
        ? `:gear:`
        : issue.labels.find((label) => label === 'story:stakeholder:cs-team')
          ? `:headphones:`
          : issue.labels.find(
                (label) => label === 'story:stakeholder:potential-user',
              )
            ? ':busts_in_silhouette:'
            : issue.labels.find(
                  (label) => label === 'story:stakeholder:sales-team',
                )
              ? ':briefcase:'
              : ':question:';
    const boardUrl =
      `${urlOfStoryView}?filterQuery=story%3A%22${encodeURI(issue.story || '')}%22+is%3Aopen`.replace(
        '#',
        '%23',
      );

    return `- ${storyColor} ${stakeHolder} ${issue.url} [:memo:](${boardUrl})`;
  })
  .join('\n')}`;
  })
  .join('\n')}`;
  };
}
