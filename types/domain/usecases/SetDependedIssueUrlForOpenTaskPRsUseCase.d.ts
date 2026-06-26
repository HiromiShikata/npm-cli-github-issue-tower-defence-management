import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class SetDependedIssueUrlForOpenTaskPRsUseCase {
    readonly issueRepository: Pick<IssueRepository, 'setDependedIssueUrl'>;
    constructor(issueRepository: Pick<IssueRepository, 'setDependedIssueUrl'>);
    run: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<void>;
    private buildOpenPrUrlsByClosedIssueUrl;
}
//# sourceMappingURL=SetDependedIssueUrlForOpenTaskPRsUseCase.d.ts.map