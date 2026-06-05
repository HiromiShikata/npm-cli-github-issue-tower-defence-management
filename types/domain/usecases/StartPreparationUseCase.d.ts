import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import { ClaudeTokenUsage } from '../entities/ClaudeTokenUsage';
export type RotationOrderEntry = {
    name: string;
    fiveHourUtilization: number;
    blocked: boolean;
    rejected: boolean;
    thresholdExcluded: boolean;
};
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly localCommandRunner;
    private readonly claudeTokenUsageRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getStoryObjectMap' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'closePullRequest' | 'deletePullRequestBranch' | 'createCommentByUrl'>, localCommandRunner: LocalCommandRunner, claudeTokenUsageRepository: ClaudeTokenUsageRepository);
    private weeklyLimitTypeForModel;
    private isModelWeeklyLimitRejected;
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
        defaultLlmAgentName: string | null;
        configFilePath: string;
        maximumPreparingIssuesCount: number | null;
        utilizationPercentageThreshold: number;
        allowedIssueAuthors: string[] | null;
        codexHomeCandidates: string[] | null;
        allowIssueCacheMinutes: number;
        labelsAsLlmAgentName: string[] | null;
    }) => Promise<{
        rotationOrder: RotationOrderEntry[] | null;
    }>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map