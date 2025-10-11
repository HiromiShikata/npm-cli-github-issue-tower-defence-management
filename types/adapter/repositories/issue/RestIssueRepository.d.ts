import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
export declare class RestIssueRepository extends BaseGitHubRepository {
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
}
//# sourceMappingURL=RestIssueRepository.d.ts.map