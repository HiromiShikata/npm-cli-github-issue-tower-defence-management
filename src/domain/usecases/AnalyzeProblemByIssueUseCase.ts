import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';

export class AnalyzeProblemByIssueUseCase {
  constructor(
    readonly issueRepository: Pick<IssueRepository, 'createComment'>,
    readonly dateRepository: Pick<
      DateRepository,
      'formatDurationToHHMM' | 'formatDateWithDayOfWeek'
    >,
  ) {}

  run = async (input: {
    targetDates: Date[];
    project: Project;
    storyObjectMap: StoryObjectMap;
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
          return `    ${getFlowchartIdFromUrl(dependedIssueUrl)} --> ${getFlowchartIdFromUrl(issue.url)}`;
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
${storyObject.issues.map((issue) => `- ${issue.url}`).join('\n')}`;

    while (noMultipleNewLineBody.includes('\n\n')) {
      noMultipleNewLineBody = noMultipleNewLineBody.replace('\n\n', '\n');
    }
    return `${flowChart}

${noMultipleNewLineBody}
`;
  };
}
