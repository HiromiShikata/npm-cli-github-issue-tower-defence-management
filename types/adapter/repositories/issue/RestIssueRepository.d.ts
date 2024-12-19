import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { Issue } from '../../../domain/entities/Issue';
export declare class RestIssueRepository extends BaseGitHubRepository {
    createComment: (issueUrl: string, comment: string) => Promise<void>;
    createNewIssue: (owner: string, repo: string, title: string, body: string, assignees: string[], labels: string[]) => Promise<void>;
    getIssue: (issueUrl: string) => Promise<{
        labels: string[];
        assignees: string[];
        title: string;
        body: string;
        number: number;
        state: string;
    }>;
    updateIssue: (issue: Issue) => Promise<void>;
}
//# sourceMappingURL=RestIssueRepository.d.ts.map