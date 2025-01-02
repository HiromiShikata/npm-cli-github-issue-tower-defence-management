import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
export declare class ClearDependedIssueURLUseCase {
    readonly issueRepository: Pick<IssueRepository, 'clearProjectField' | 'createComment' | 'updateProjectTextField'>;
    constructor(issueRepository: Pick<IssueRepository, 'clearProjectField' | 'createComment' | 'updateProjectTextField'>);
    run: (input: {
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
    }) => Promise<void>;
}
//# sourceMappingURL=ClearDependedIssueURLUseCase.d.ts.map