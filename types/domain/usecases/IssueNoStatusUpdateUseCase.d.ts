import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class IssueNoStatusUpdateUseCase {
    readonly issueRepository: Pick<IssueRepository, 'updateStatus'>;
    constructor(issueRepository: Pick<IssueRepository, 'updateStatus'>);
    run: (input: {
        project: Project;
        issues: Issue[];
    }) => Promise<void>;
}
//# sourceMappingURL=IssueNoStatusUpdateUseCase.d.ts.map