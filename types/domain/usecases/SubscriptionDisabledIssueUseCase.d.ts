import { IssueRepository } from './adapter-interfaces/IssueRepository';
export type SubscriptionDisabledTokenEntry = {
    name: string;
    subscriptionDisabled: boolean;
};
export declare class SubscriptionDisabledIssueUseCase {
    private readonly issueRepository;
    constructor(issueRepository: Pick<IssueRepository, 'searchIssue' | 'createNewIssue' | 'createCommentByUrl'>);
    run: (input: {
        tokenEntries: SubscriptionDisabledTokenEntry[];
        org: string;
        repo: string;
    }) => Promise<void>;
    private handleDisabledToken;
}
//# sourceMappingURL=SubscriptionDisabledIssueUseCase.d.ts.map