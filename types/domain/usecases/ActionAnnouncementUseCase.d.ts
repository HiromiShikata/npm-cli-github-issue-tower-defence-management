import { Issue } from '../entities/Issue';
import { Member } from '../entities/Member';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
export declare class ActionAnnouncementUseCase {
    readonly issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue'>;
    constructor(issueRepository: Pick<IssueRepository, 'createNewIssue' | 'updateIssue'>);
    run: (input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
        members: Member["name"][];
        manager: Member["name"];
    }) => Promise<void>;
}
//# sourceMappingURL=ActionAnnouncementUseCase.d.ts.map