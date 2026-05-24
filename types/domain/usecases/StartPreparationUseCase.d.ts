import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly localCommandRunner;
    private readonly claudeTokenUsageRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getStoryObjectMap' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'closePullRequest' | 'deletePullRequestBranch' | 'createCommentByUrl'>, localCommandRunner: LocalCommandRunner, claudeTokenUsageRepository: ClaudeTokenUsageRepository);
    private weeklyLimitTypeForModel;
    private isModelWeeklyLimitRejected;
    private selectRotationTokens;
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
    }) => Promise<void>;
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map