import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class SetDependedIssueUrlForOpenTaskPRsUseCase {
    readonly issueRepository: Pick<IssueRepository, 'findRelatedOpenPRs' | 'setDependedIssueUrl'>;
    constructor(issueRepository: Pick<IssueRepository, 'findRelatedOpenPRs' | 'setDependedIssueUrl'>);
    run: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<void>;
}
//# sourceMappingURL=SetDependedIssueUrlForOpenTaskPRsUseCase.d.ts.map