import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
import { encodeForURI } from './utils';

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
    members: Member['name'][];
  }): Promise<void> => {
    const story = input.project.story;
    if (
      !story ||
      !input.targetDates.find(
        (targetDate) =>
          targetDate.getHours() === 5 && targetDate.getMinutes() === 0,
      )
    ) {
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
        phases.get('others')?.push(storyIssueObject);
      }
    }
    await this.issueRepository.createNewIssue(
      input.org,
      input.repo,
      `Story progress`,
      this.createSummaryIssueBody(
        input.project,
        input.issues,
        phases,
        input.storyObjectMap,
        input.urlOfStoryView,
        input.members,
      ),
      [input.manager],
      ['story:workflow-management'],
    );
  };
  createSummaryIssueBody = (
    project: Project,
    issues: Issue[],
    summaryStoryIssue: Map<
      string,
      (Issue & {
        name: string;
        color: string;
        description: string;
      })[]
    >,
    storyObjectMap: StoryObjectMap,
    urlOfStoryView: string,
    members: Member['name'][],
  ) => {
    return `${this.createSummaryIssueBodyPhase(summaryStoryIssue, urlOfStoryView, storyObjectMap)}
${this.createSummaryIssueBodyAssignedIssueCount(project, issues, storyObjectMap, urlOfStoryView, members)}
`;
  };

  createStoryMark = (
    urlOfStoryView: string,
    issue: Issue | null,
    storyOption: Omit<StoryOption, 'id'>,
  ): {
    storyColorIcon: string;
    stakeHolderIcon: string;
    boardIcon: string;
    boardUrl: string;
    isScheduleControlled: boolean;
    scheduleControlledIcon: string;
    scheduleControlledUrl: string;
  } => {
    const storyColor = `:${storyOption.color === 'BLUE' ? 'large_' : ''}${storyOption.color === 'GRAY' ? 'black' : storyOption.color === 'PINK' ? 'red' : storyOption.color.toLowerCase()}_circle:`;
    const stakeHolder =
      issue === null
        ? ' '
        : issue.labels.find((label) => label === 'story:stakeholder:user')
          ? `:bust_in_silhouette:`
          : issue.labels.find((label) => label === 'story:stakeholder:engineer')
            ? `:gear:`
            : issue.labels.find(
                  (label) => label === 'story:stakeholder:cs-team',
                )
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
    const boardUrl = `${urlOfStoryView}?filterQuery=story%3A%22${encodeForURI(storyOption.name)}%22+is%3Aopen`;
    const boardIcon = `:memo:`;
    const isScheduleControlled =
      issue !== null && issue.labels.includes('story:action:schedule-control');
    const scheduleControlledIcon = `:calendar:`;
    const scheduleControlledUrl = `${urlOfStoryView}?filterQuery=%22Put+estimation+fields%22+%22${encodeForURI(storyOption.name)}%22`;

    return {
      storyColorIcon: storyColor,
      stakeHolderIcon: stakeHolder,
      boardUrl,
      boardIcon,
      isScheduleControlled,
      scheduleControlledIcon,
      scheduleControlledUrl,
    };
  };
  createSummaryIssueBodyPhase = (
    summaryStoryIssue: Map<
      string,
      (Issue & {
        name: string;
        color: string;
        description: string;
      })[]
    >,
    urlOfStoryView: string,
    storyObjectMap: StoryObjectMap,
  ): string => {
    return `

${Array.from(summaryStoryIssue.keys())
  .map((key) => {
    return `
## ${key}
${summaryStoryIssue
  .get(key)
  ?.map((issue) => {
    const {
      storyColorIcon,
      stakeHolderIcon,
      boardIcon,
      boardUrl,
      isScheduleControlled,
      scheduleControlledIcon,
      scheduleControlledUrl,
    } = this.createStoryMark(urlOfStoryView, issue, issue);
    const issuesInStory =
      storyObjectMap
        .get(issue.name)
        ?.issues.filter((issue) => !issue.isClosed && !issue.isPr) || [];
    const remainingIssueCount = issuesInStory.length;
    return `- ${storyColorIcon} ${stakeHolderIcon} ${isScheduleControlled ? `[${scheduleControlledIcon}](${scheduleControlledUrl})` : ''} [(${remainingIssueCount})](${boardUrl}) ${issue.url} [${boardIcon}](${boardUrl})`;
  })
  .join('\n')}`;
  })
  .join('\n')}`;
  };
  createSummaryIssueBodyAssignedIssueCount = (
    project: Project,
    issues: Issue[],
    storyObjectMap: StoryObjectMap,
    urlOfStoryView: string,
    members: Member['name'][],
  ): string => {
    return `
 <table>
 <thead>
 <tr>
 <th>story/<br/>assignee</th>
${members.map((member) => `<th><img src="https://github.com/${member}.png?size=40" alt="${member}" /></th>`).join('\n')}
</tr>
</thead>
<tbody>
${Array.from(project.story?.stories.values() || [])
  .map((storyOption) => {
    const issue: Issue | null =
      issues.find((issue) => storyOption.name.startsWith(issue.title)) || null;
    const {
      storyColorIcon,
      stakeHolderIcon,
      boardIcon,
      boardUrl,
      isScheduleControlled,
      scheduleControlledIcon,
      scheduleControlledUrl,
    } = this.createStoryMark(urlOfStoryView, issue, storyOption);
    return `
<tr>
<td>
${storyOption.name}<br/>
<a href="${boardUrl}">${boardIcon}</a> ${storyColorIcon} ${stakeHolderIcon} ${isScheduleControlled ? `<a href="${scheduleControlledUrl}">${scheduleControlledIcon}</a>` : ''}
</td>
${members
  .map((member) => {
    const assignedIssuesInStory = issues.filter(
      (issue) =>
        issue.story === storyOption.name &&
        !issue.isClosed &&
        !issue.isPr &&
        issue.assignees.includes(member),
    );
    return `<td>${assignedIssuesInStory.length > 0 ? assignedIssuesInStory.length : ''}</td>`;
  })
  .join('\n')}
</tr>
 
 
`;
  })
  .join('\n')}
</tbody>
</table>
`;
  };
}
