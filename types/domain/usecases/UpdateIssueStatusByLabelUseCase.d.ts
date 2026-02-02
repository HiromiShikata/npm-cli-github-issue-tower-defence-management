import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare class UpdateIssueStatusByLabelUseCase {
    readonly issueRepository: Pick<IssueRepository, 'updateStatus' | 'removeLabel'>;
    constructor(issueRepository: Pick<IssueRepository, 'updateStatus' | 'removeLabel'>);
    static readonly STATUS_LABEL_PREFIX = "status:";
    static normalizeStatus: (status: string) => string;
    run: (input: {
        project: Project;
        issues: Issue[];
        defaultStatus: string | null;
    }) => Promise<void>;
}
//# sourceMappingURL=UpdateIssueStatusByLabelUseCase.d.ts.map