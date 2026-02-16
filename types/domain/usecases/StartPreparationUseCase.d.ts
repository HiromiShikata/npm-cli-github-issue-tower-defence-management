import { Issue } from '../entities/Issue';
import { Project, StoryOption } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeRepository } from './adapter-interfaces/ClaudeRepository';
export type StoryObject = {
    story: StoryOption;
    storyIssue: Issue | null;
    issues: Issue[];
};
export type StoryObjectMap = Map<NonNullable<Project['story']>['stories'][0]['name'], StoryObject>;
export declare class StartPreparationUseCase {
    readonly projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>;
    readonly issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>;
    readonly claudeRepository: Pick<ClaudeRepository, 'getUsage'>;
    readonly localCommandRunner: LocalCommandRunner;
    constructor(projectRepository: Pick<ProjectRepository, 'findProjectIdByUrl' | 'getProject'>, issueRepository: Pick<IssueRepository, 'getAllIssues' | 'updateStatus'>, claudeRepository: Pick<ClaudeRepository, 'getUsage'>, localCommandRunner: LocalCommandRunner);
    run: (params: {
        projectUrl: string;
        awaitingWorkspaceStatus: string;
        preparationStatus: string;
        defaultAgentName: string;
        logFilePath?: string;
        maximumPreparingIssuesCount: number | null;
        allowIssueCacheMinutes: number;
    }) => Promise<void>;
    createStoryObjectMap: (input: {
        project: Project;
        issues: Issue[];
    }) => StoryObjectMap;
    createWorkflowBlockerIssues: (storyObjectMap: StoryObjectMap) => {
        orgRepo: string;
        blockerIssueUrls: string[];
    }[];
}
//# sourceMappingURL=StartPreparationUseCase.d.ts.map