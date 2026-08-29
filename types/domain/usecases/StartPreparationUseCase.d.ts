import { IssueRepository, RelatedPullRequest } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
export declare const NORMAL_CONCURRENT_LIMIT = 6;
export declare const DEFAULT_FALLBACK_LLM_MODEL_NAME = "claude-opus-4-8";
export declare const SPAWN_CANDIDATE_BRANCH_SOURCE_CONCURRENCY = 8;
export type SpawnCandidateExclusionReason = 'dependedIssueUrls' | 'futureNextActionDate' | 'nextActionHourNotReached' | 'authorNotAllowed' | 'notAssignedToManager';
export type SpawnCandidateBranchSource = {
    openPullRequest: RelatedPullRequest | null;
    relatedOpenPullRequests: RelatedPullRequest[];
};
export declare const agentNameFromDesignation: (designation: string) => string;
export type RotationOrderEntry = {
    name: string;
    fiveHourUtilization: number;
    blocked: boolean;
    rejected: boolean;
    thresholdExcluded: boolean;
    cooldownExcluded: boolean;
};
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly localCommandRunner;
    private readonly claudeTokenUsageRepository;
    private readonly takeOwnershipSpawnRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>, issueRepository: Pick<IssueRepository, 'getStoryObjectMap' | 'getAllOpened' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'closePullRequest' | 'deletePullRequestBranch' | 'createCommentByUrl' | 'setIssueAgentField' | 'removeLabel'>, localCommandRunner: LocalCommandRunner, claudeTokenUsageRepository: ClaudeTokenUsageRepository, takeOwnershipSpawnRepository: TakeOwnershipSpawnRepository);
    private weeklyLimitTypeForModel;
    private isWithinCooldown;
    private isModelWeeklyLimitRejected;
    private selectModelForToken;
    private secondsUntilSevenDayReset;
    private compareBySevenDayDeadlineThenUtilization;
    private taperedConcurrentLimit;
    getTokenConcurrentLimit: (fiveHourUtilization: number, sevenDayUtilization: number, selectionWeight?: number, normalConcurrentLimit?: number) => number;
    spawnCandidateExclusionReasonOf: (issue: Issue, allowedIssueAuthors: string[] | null, manager: string, now: Date) => SpawnCandidateExclusionReason | null;
    fetchSpawnCandidateBranchSources: (issueUrls: string[]) => Promise<Map<string, SpawnCandidateBranchSource>>;
    private selectRotationTokens;
    buildRotationOrder: (tokenUsages: ClaudeTokenUsage[], utilizationPercentageThreshold: number, modelName: string | null) => RotationOrderEntry[];
    run: (params: {
        projectUrl: string;
        defaultAgentName: string;
        defaultLlmModelName: string | null;
        fallbackLlmModelName: string | null;
        defaultLlmAgentName: string | null;
        configFilePath: string;
        maximumPreparingIssuesCount: number | null;
        utilizationPercentageThreshold: number;
        allowedIssueAuthors: string[] | null;
        manager: string;
        codexHomeCandidates: string[] | null;
        labelsAsLlmAgentName: string[] | null;
        agents?: string[] | null;
        normalConcurrentLimit?: number;
    }) => Promise<{
        rotationOrder: RotationOrderEntry[] | null;
    }>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map