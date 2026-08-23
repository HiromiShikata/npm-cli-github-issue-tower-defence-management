import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class QualityCheckAdvanceUseCase {
    private readonly issueRepository;
    constructor(issueRepository: Pick<IssueRepository, 'updateStatus'>);
    run: (params: {
        project: Project;
        issues: Issue[];
        awaitingQualityCheckStatusName?: string;
        evaluatedAt?: Date;
    }) => Promise<number>;
}
//# sourceMappingURL=QualityCheckAdvanceUseCase.d.ts.map