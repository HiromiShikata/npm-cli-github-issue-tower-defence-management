import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
export declare class StartPreparationUseCase {
    private readonly projectRepository;
    private readonly issueRepository;
    private readonly claudeRepository;
    private readonly localCommandRunner;
    private readonly claudeTokenUsageRepository;
    constructor(projectRepository: Pick<ProjectRepository, 'getByUrl'>, issueRepository: Pick<IssueRepository, 'getStoryObjectMap' | 'updateStatus' | 'findRelatedOpenPRs' | 'getOpenPullRequest' | 'closePullRequest' | 'deletePullRequestBranch' | 'createCommentByUrl'>, claudeRepository: Pick<ClaudeRepository, 'getUsage'>, localCommandRunner: LocalCommandRunner, claudeTokenUsageRepository: ClaudeTokenUsageRepository);
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