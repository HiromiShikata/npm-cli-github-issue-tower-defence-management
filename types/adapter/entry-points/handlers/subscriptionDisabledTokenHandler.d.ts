import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
export type SubscriptionDisabledTokenHandlerParams = {
    tokenListJsonPath: string | null;
    org: string;
    repo: string;
    issueRepository: Pick<IssueRepository, 'searchIssue' | 'createNewIssue' | 'createCommentByUrl'>;
};
export declare const handleSubscriptionDisabledTokens: (params: SubscriptionDisabledTokenHandlerParams) => Promise<void>;
//# sourceMappingURL=subscriptionDisabledTokenHandler.d.ts.map