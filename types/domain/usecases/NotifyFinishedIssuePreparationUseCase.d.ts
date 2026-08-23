import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';
import { ConsoleTabsRepository } from './adapter-interfaces/ConsoleTabsRepository';
export declare class IssueNotFoundError extends Error {
    constructor(issueUrl: string);
}
export declare class IllegalIssueStatusError extends Error {
    constructor(issueUrl: string, currentStatus: string | null, expectedStatus: string | null);
}
export declare class NotifyFinishedIssuePreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly issueCommentRepository;
    private readonly webhookRepository;
    private readonly consoleTabsRepository?;
    private readonly issueRejectionEvaluator;
    private readonly changeTargetPullRequestApprover;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'updateAgentList' | 'createField'>, issueRepository: Pick<IssueRepository, 'get' | 'update' | 'updateStatus' | 'updateLabels' | 'getOrCreateLabel' | 'findRelatedOpenPRs' | 'getStoryObjectMap' | 'getOpenPullRequest' | 'getPullRequestChangedFilePaths' | 'approvePullRequest' | 'requestChangesWithInlineComment' | 'setDependedIssueUrl' | 'setIssueAgentField' | 'searchIssue' | 'createNewIssue'>, issueCommentRepository: Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>, webhookRepository: Pick<WebhookRepository, 'sendGetRequest'>, consoleTabsRepository?: (ConsoleTabsRepository | null) | undefined);
    run: (params: {
        projectUrl: string;
        issueUrl: string;
        thresholdForAutoReject: number;
        workflowBlockerResolvedWebhookUrl: string | null;
        allowedIssueAuthors?: string[] | null;
        labelsAsLlmAgentName?: string[] | null;
        labelsNotRequiringPullRequest?: string[] | null;
        changeTargetPathAliases?: Record<string, string> | null;
        agents?: string[] | null;
        missingAgentName?: string | null;
        sessionErrorLine?: string | null;
        manager?: string | null;
    }) => Promise<void>;
    private handleMissingAgentDefinition;
    private isAuthorTrusted;
    private collectRejections;
    private reportBodyHasNextStep;
    private setDependedIssueUrlForAllOpenPRs;
    private resolveOpenPrsForPrItem;
    private sendWorkflowBlockerNotification;
    private resolveConsoleTargetTab;
    private extractNextStepAgent;
    private ensureAgentOptionAndGetId;
    private patchConsoleTab;
}
//# sourceMappingURL=NotifyFinishedIssuePreparationUseCase.d.ts.map