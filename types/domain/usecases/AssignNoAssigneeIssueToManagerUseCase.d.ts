import { Issue } from '../entities/Issue';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Member } from '../entities/Member';
export declare class AssignNoAssigneeIssueToManagerUseCase {
    readonly issueRepository: Pick<IssueRepository, 'updateAssigneeList'>;
    constructor(issueRepository: Pick<IssueRepository, 'updateAssigneeList'>);
    run: (input: {
        issues: Issue[];
        manager: Member["name"];
        cacheUsed: boolean;
    }) => Promise<void>;
}
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.d.ts.map