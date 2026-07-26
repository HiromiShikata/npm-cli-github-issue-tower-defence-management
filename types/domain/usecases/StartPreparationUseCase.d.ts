import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
export declare const DEFAULT_FALLBACK_LLM_MODEL_NAME = "claude-opus-4-8";
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
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getStoryObjectMap' | 'getAllOpened' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'closePullRequest' | 'deletePullRequestBranch' | 'createCommentByUrl'>, localCommandRunner: LocalCommandRunner, claudeTokenUsageRepository: ClaudeTokenUsageRepository);
    private weeklyLimitTypeForModel;
    private isWithinCooldown;
    private isModelWeeklyLimitRejected;
    private selectModelForToken;
    private secondsUntilSevenDayReset;
    private compareBySevenDayDeadlineThenUtilization;
    private taperedConcurrentLimit;
    getTokenConcurrentLimit: (fiveHourUtilization: number, sevenDayUtilization: number) => number;
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
    }) => Promise<{
        rotationOrder: RotationOrderEntry[] | null;
    }>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map