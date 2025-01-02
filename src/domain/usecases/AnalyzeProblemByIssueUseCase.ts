import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObject, StoryObjectMap } from './HandleScheduledEventUseCase';
import { isVisibleIssue } from './utils';

export class AnalyzeProblemByIssueUseCase {
  constructor(
    readonly issueRepository: Pick<
      IssueRepository,
      'createNewIssue' | 'createComment'
    >,
    readonly dateRepository: Pick<
      DateRepository,
      | 'formatDurationToHHMM'
      | 'formatDateTimeWithDayOfWeek'
      | 'formatStartEnd'
      | 'formatDateWithDayOfWeek'
    >,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    manager: Member['name'];
    members: Member['name'][];
    org: string;
    repo: string;
    storyObjectMap: StoryObjectMap;
    disabledStatus: string;
  }): Promise<void> => {
    const story = input.project.story;
    if (
      !story ||
      !input.targetDates.find(
        (targetDate) =>
          targetDate.getHours() === 0 && targetDate.getMinutes() === 0,
      )
    ) {
      return;
    }
    const targetDate = input.targetDates[input.targetDates.length - 1];
    if (!targetDate) {
      return;
    }
    await this.checkInProgress({ ...input, targetDate });
    for (const storyObject of input.storyObjectMap.values()) {
      const storyIssue = storyObject.storyIssue;
      if (!storyIssue) {
        continue;
      }
      await this.issueRepository.createComment(
        storyIssue,
        this.createSummaryCommentBody({ ...storyObject, storyIssue }),
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  };
  checkInProgress = async (
    input: Parameters<AnalyzeProblemByIssueUseCase['run']>[0] & {
      targetDate: Date;
    },
  ) => {
    const assigneeToNotify: Member['name'][] = [];
    for (const member of input.members) {
      let topIssue: Issue | null = null;
      for (const story of input.storyObjectMap.values()) {
        const storyIssueObject = input.storyObjectMap.get(story.story.name);
        if (!storyIssueObject) {
          continue;
        } else if (assigneeToNotify.includes(member)) {
          break;
        }
        for (const issue of storyIssueObject.issues) {
          if (
            !isVisibleIssue(
              issue,
              member,
              input.targetDate,
              input.disabledStatus,
            ) ||
            issue.status?.toLowerCase().includes('review') ||
            issue.title.toLowerCase().includes('review') ||
            issue.isPr
          ) {
            continue;
          }
          if (topIssue === null) {
            topIssue = issue;
            break;
          }
          if (!issue.isInProgress) {
            continue;
          }
          assigneeToNotify.push(member);
          break;
        }
      }
    }
    if (assigneeToNotify.length === 0) {
      return;
    }
    await this.issueRepository.createNewIssue(
      input.org,
      input.repo,
      'Check in progress',
      `${assigneeToNotify.join('\n')}`,
      [input.manager],
      ['story:workflow-management'],
    );
  };
  createSummaryCommentBody = (
    storyObject: StoryObject & {
      storyIssue: NonNullable<StoryObject['storyIssue']>;
    },
  ): string => {
    const getFlowchartIdFromUrl = (url: string) => {
      return url.split('/').slice(-3).join('/');
    };
    const issueTitleForFlowchart = (title: string) => {
      return title.replace('"', "'");
    };
    const flowChart = `
\`\`\`mermaid

flowchart TD
${storyObject.issues
  .map(
    (issue) =>
      `    ${getFlowchartIdFromUrl(issue.url)}["${issue.isClosed ? '🟣' : '🟢'}#${issue.number} ${issue.isClosed ? 'Closed' : 'Open'}<br/>${issue.assignees.map((a) => `${a}`).join('<br/>')}<br/>${issueTitleForFlowchart(issue.title)}"]`,
  )
  .join('\n')}
${storyObject.issues
  .map((issue) =>
    Array.from(issue.dependedIssueUrls)
      .map((dependedIssueUrl) => {
        if (issue.isClosed) {
          issue.totalWorkingTimeByAssignee;
          return `    ${getFlowchartIdFromUrl(dependedIssueUrl)} -->|total: ${this.dateRepository.formatDurationToHHMM(issue.totalWorkingTime)}<br/>${Array.from(
            issue.totalWorkingTimeByAssignee,
          )
            .map(
              ([author, workingMinutes]) =>
                `@${author} ${this.dateRepository.formatDurationToHHMM(workingMinutes)}`,
            )
            .join('<br/>')}| ${getFlowchartIdFromUrl(issue.url)}`;
        }
        return `    ${getFlowchartIdFromUrl(dependedIssueUrl)} -->|${
          issue.estimationMinutes
            ? `Estimation: ${this.dateRepository.formatDurationToHHMM(issue.estimationMinutes)}<br/>`
            : ''
        }<br/>by ${
          issue.completionDate50PercentConfidence
            ? this.dateRepository.formatDateWithDayOfWeek(
                issue.completionDate50PercentConfidence,
              )
            : 'Unknown'
        }| ${getFlowchartIdFromUrl(issue.url)}`;
      })
      .join('\n'),
  )
  .join('\n')}
    %% click event 
    ${storyObject.issues
      .map(
        (issue) => `click ${getFlowchartIdFromUrl(issue.url)} "${issue.url}"`,
      )
      .join('\n')}
    
\`\`\``;
    let noMultipleNewLineBody = `
Total: ${this.dateRepository.formatDurationToHHMM(Array.from(storyObject.issues.values()).reduce((a, b) => a + b.totalWorkingTime, 0))}

${storyObject.issues
  .map(
    (
      issue,
    ) => `- ${this.dateRepository.formatDurationToHHMM(issue.totalWorkingTime)} ${issue.url}
  - Total
${Array.from(issue.totalWorkingTimeByAssignee)
  .map(
    ([author, workingMinutes]) =>
      `    - ${this.dateRepository.formatDurationToHHMM(workingMinutes)}, ${author}`,
  )
  .join('\n')}
  - Timeline
${issue.workingTimeline
  .map(
    ({ startedAt, endedAt, durationMinutes, author }) =>
      `    - ${this.dateRepository.formatDurationToHHMM(durationMinutes)}, ${this.dateRepository.formatStartEnd(startedAt, endedAt)}}, ${author}`,
  )
  .join('\n')}`,
  )
  .join('\n')}`;

    while (noMultipleNewLineBody.includes('\n\n')) {
      noMultipleNewLineBody = noMultipleNewLineBody.replace('\n\n', '\n');
    }
    return `${flowChart}

${noMultipleNewLineBody}
`;
  };

  createQuestionIssueBody = (
    issue: Issue,
    totalWorkingTime: number,
    totalWorkingTimeByAssignee: Map<string, number>,
  ): string => {
    return `Hi,
I worry about the situation of #${issue.number} (${issue.title}) because the total working time is over 120 minutes.
Could you please share the situation? :pray:

## Total
${this.dateRepository.formatDurationToHHMM(totalWorkingTime)}

## From the record
Working Minutes, Author, 
${Array.from(totalWorkingTimeByAssignee)
  .map(
    ([author, workingMinutes]) =>
      `${this.dateRepository.formatDurationToHHMM(workingMinutes)}, ${author}`,
  )
  .join('\n')}


## Timeline
Start, End, Duration, Author
${issue.workingTimeline
  .map(
    ({ startedAt, endedAt, durationMinutes, author }) =>
      `${this.dateRepository.formatDurationToHHMM(
        startedAt.getMinutes(),
      )}, ${this.dateRepository.formatDurationToHHMM(
        endedAt.getMinutes(),
      )}, ${this.dateRepository.formatDurationToHHMM(durationMinutes)}, ${author}`,
  )
  .join('\n')}
`;
  };
}
