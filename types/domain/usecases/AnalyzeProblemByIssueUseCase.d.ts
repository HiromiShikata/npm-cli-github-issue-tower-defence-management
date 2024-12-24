import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { Member } from '../entities/Member';
import { DateRepository } from './adapter-interfaces/DateRepository';
export declare class AnalyzeProblemByIssueUseCase {
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
  }) => Promise<void>;
  createSummaryIssueBody: (
    summaryStoryIssue: Map<
      string,
      Map<
        Issue,
        {
          totalWorkingTime: number;
          totalWorkingTimeByAssignee: Map<string, number>;
        }
      >
    >,
  ) => string;
  createQuestionIssueBody: (
    issue: Issue,
    totalWorkingTime: number,
    totalWorkingTimeByAssignee: Map<string, number>,
  ) => string;
  calculateTotalWorkingMinutesByAssignee: (issue: Issue) => Map<string, number>;
}
//# sourceMappingURL=AnalyzeProblemByIssueUseCase.d.ts.map
