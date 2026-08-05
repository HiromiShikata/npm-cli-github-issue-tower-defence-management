import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class StaleTaskPullRequestCloseUseCase {
    readonly issueRepository: Pick<IssueRepository, 'closePullRequest'>;
    constructor(issueRepository: Pick<IssueRepository, 'closePullRequest'>);
    run: (input: {
        issues: Issue[];
    }) => Promise<void>;
}
//# sourceMappingURL=StaleTaskPullRequestCloseUseCase.d.ts.map