import { BaseGitHubRepository } from '../BaseGitHubRepository';
export declare class ApiV3IssueRepository extends BaseGitHubRepository {
    searchIssue: (query: {
        owner: string;
        repositoryName: string;
        type?: "issue" | "pr";
        state?: "open" | "closed" | "all";
        title?: string;
        createdFrom?: string;
        assignee?: string;
    }) => Promise<{
        url: string;
        title: string;
        number: string;
    }[]>;
}
//# sourceMappingURL=ApiV3IssueRepository.d.ts.map