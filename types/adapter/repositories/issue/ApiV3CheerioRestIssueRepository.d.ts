import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { CheerioIssueRepository, Issue as CheerioIssue } from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository, ProjectItem } from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
export declare class ApiV3CheerioRestIssueRepository extends BaseGitHubRepository implements IssueRepository {
    readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>;
    readonly cheerioIssueRepository: Pick<CheerioIssueRepository, 'getIssue'>;
    readonly restIssueRepository: Pick<RestIssueRepository, 'createNewIssue' | 'updateIssue'>;
    readonly graphqlProjectItemRepository: Pick<GraphqlProjectItemRepository, 'fetchProjectItems' | 'fetchProjectItemByUrl' | 'updateProjectField' | 'clearProjectField'>;
    readonly localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
    constructor(apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>, cheerioIssueRepository: Pick<CheerioIssueRepository, 'getIssue'>, restIssueRepository: Pick<RestIssueRepository, 'createNewIssue' | 'updateIssue'>, graphqlProjectItemRepository: Pick<GraphqlProjectItemRepository, 'fetchProjectItems' | 'fetchProjectItemByUrl' | 'updateProjectField' | 'clearProjectField'>, localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>);
    convertProjectItemAndCheerioIssueToIssue: (item: ProjectItem, cheerioIssue: CheerioIssue) => Promise<Issue>;
    getAllIssuesFromCache: (cacheKey: string, allowCacheMinutes: number) => Promise<Issue[] | null>;
    getAllIssues: (projectId: Project["id"], allowCacheMinutes: number) => Promise<{
        issues: Issue[];
        cacheUsed: boolean;
    }>;
    getAllIssuesFromGitHub: (projectId: Project["id"]) => Promise<Issue[]>;
    createNewIssue: (org: string, repo: string, title: string, body: string, assignees: string[], labels: string[]) => Promise<void>;
    updateIssue: (issue: Issue) => Promise<void>;
    getIssueByUrl: (url: string) => Promise<Issue | null>;
    updateNextActionDate: (project: Project & {
        nextActionDate: Required<Project["nextActionDate"]>;
    }, issue: Issue, date: Date) => Promise<void>;
    updateNextActionHour: (project: Project & {
        nextActionHour: NonNullable<Project["nextActionHour"]>;
    }, issue: Issue, hour: number) => Promise<void>;
    updateStory: (project: Project & {
        story: NonNullable<Project["story"]>;
    }, issue: Issue, storyOptionId: string) => Promise<void>;
    clearProjectField: (project: Project, fieldId: string, issue: Issue) => Promise<void>;
}
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.d.ts.map