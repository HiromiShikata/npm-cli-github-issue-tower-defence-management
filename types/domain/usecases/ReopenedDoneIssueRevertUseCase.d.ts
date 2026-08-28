import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class ReopenedDoneIssueRevertUseCase {
    private readonly issueRepository;
    constructor(issueRepository: Pick<IssueRepository, 'updateStatus'>);
    run: (params: {
        project: Project;
        issues: Issue[];
    }) => Promise<number>;
}
//# sourceMappingURL=ReopenedDoneIssueRevertUseCase.d.ts.map