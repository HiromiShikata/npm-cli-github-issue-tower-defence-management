import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Member } from '../entities/Member';
export declare class AssignNoAssigneeIssueToManagerUseCase {
    readonly issueRepository: Pick<IssueRepository, 'updateAssigneeList' | 'searchIssues' | 'addIssueToProject'>;
    constructor(issueRepository: Pick<IssueRepository, 'updateAssigneeList' | 'searchIssues' | 'addIssueToProject'>);
    run: (input: {
        issues: Issue[];
        manager: Member["name"];
        cacheUsed: boolean;
        autoAssignManagerAuthors?: string[] | null;
        projectToAddSearchedIssues?: Project | null;
        queryToAddProjectEnabled?: boolean | null;
        queryToAddProject?: string | null;
    }) => Promise<void>;
    private searchIssues;
    private addToProject;
    private assignManager;
    private waitBeforeNextRequest;
}
//# sourceMappingURL=AssignNoAssigneeIssueToManagerUseCase.d.ts.map