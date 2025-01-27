import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project, StoryOption } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';
export declare class AnalyzeStoriesUseCase {
  readonly issueRepository: Pick<IssueRepository, 'createNewIssue'>;
  readonly dateRepository: Pick<DateRepository, 'formatDurationToHHMM'>;
  constructor(
    issueRepository: Pick<IssueRepository, 'createNewIssue'>,
    dateRepository: Pick<DateRepository, 'formatDurationToHHMM'>,
  );
  run: (input: {
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
  }) => Promise<void>;
  createSummaryIssueBody: (
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
  ) => string;
  createStoryMark: (
    urlOfStoryView: string,
    issue: Issue | null,
    storyOption: Omit<StoryOption, 'id'>,
  ) => {
    storyColorIcon: string;
    stakeHolderIcon: string;
    boardIcon: string;
    boardUrl: string;
    isScheduleControlled: boolean;
    scheduleControlledIcon: string;
    scheduleControlledUrl: string;
  };
  createSummaryIssueBodyPhase: (
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
  ) => string;
  createSummaryIssueBodyAssignedIssueCount: (
    project: Project,
    issues: Issue[],
    storyObjectMap: StoryObjectMap,
    urlOfStoryView: string,
    members: Member['name'][],
  ) => string;
}
//# sourceMappingURL=AnalyzeStoriesUseCase.d.ts.map
