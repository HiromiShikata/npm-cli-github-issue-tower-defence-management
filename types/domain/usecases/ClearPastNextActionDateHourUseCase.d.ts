import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
export declare class ClearPastNextActionDateHourUseCase {
    readonly issueRepository: Pick<IssueRepository, 'clearProjectField'>;
    constructor(issueRepository: Pick<IssueRepository, 'clearProjectField'>);
    run: (input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
    }) => Promise<void>;
}
//# sourceMappingURL=ClearPastNextActionDateHourUseCase.d.ts.map