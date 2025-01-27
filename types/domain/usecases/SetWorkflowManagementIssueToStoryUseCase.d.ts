import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
export declare class SetWorkflowManagementIssueToStoryUseCase {
  readonly issueRepository: Pick<IssueRepository, 'updateStory'>;
  constructor(issueRepository: Pick<IssueRepository, 'updateStory'>);
  run: (input: {
    targetDates: Date[];
    project: Project;
    issues: Issue[];
    cacheUsed: boolean;
  }) => Promise<void>;
}
//# sourceMappingURL=SetWorkflowManagementIssueToStoryUseCase.d.ts.map
