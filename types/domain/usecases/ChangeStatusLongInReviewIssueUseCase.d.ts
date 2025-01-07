import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
export declare class ChangeStatusLongInReviewIssueUseCase {
  readonly dateRepository: Pick<DateRepository, 'now'>;
  readonly issueRepository: Pick<
    IssueRepository,
    'updateStatus' | 'createComment'
  >;
  constructor(
    dateRepository: Pick<DateRepository, 'now'>,
    issueRepository: Pick<IssueRepository, 'updateStatus' | 'createComment'>,
  );
  run: (input: {
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
    org: string;
    repo: string;
  }) => Promise<void>;
}
//# sourceMappingURL=ChangeStatusLongInReviewIssueUseCase.d.ts.map
