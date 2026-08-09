import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Member } from '../../../domain/entities/Member';
import { SearchedIssue } from '../../../domain/entities/SearchedIssue';
export declare class RestIssueRepository extends BaseGitHubRepository implements Pick<IssueRepository, 'updateAssigneeList' | 'removeLabel' | 'searchIssues'> {
    createComment: (issueUrl: string, comment: string) => Promise<void>;
    createNewIssue: (owner: string, repo: string, title: string, body: string, assignees: string[], labels: string[]) => Promise<number>;
    getIssue: (issueUrl: string) => Promise<{
        labels: string[];
        assignees: string[];
        title: string;
        body: string;
        number: number;
        state: string;
        created_at: string;
    }>;
    updateIssue: (issue: Issue) => Promise<void>;
    updateLabels: (issue: Issue, labels: Issue["labels"]) => Promise<void>;
    removeLabel: (issue: Issue, label: string) => Promise<void>;
    updateAssigneeList: (issue: Pick<Issue, "org" | "repo" | "number">, assigneeList: Member["name"][]) => Promise<void>;
    searchIssues: (query: string) => Promise<SearchedIssue[]>;
    private parseSearchedIssue;
}
//# sourceMappingURL=RestIssueRepository.d.ts.map