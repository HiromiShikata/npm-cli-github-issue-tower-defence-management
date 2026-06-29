import { IssueRepository, RelatedPullRequest, IssueComment, PullRequestDetail, PullRequestCommit, PullRequestReviewCommentSide } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { StoryObjectMap } from '../../../domain/entities/StoryObjectMap';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository, ProjectItem } from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { Member } from '../../../domain/entities/Member';
export declare class ApiV3CheerioRestIssueRepository extends BaseGitHubRepository implements IssueRepository {
    readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>;
    readonly restIssueRepository: Pick<RestIssueRepository, 'createNewIssue' | 'updateIssue' | 'createComment' | 'getIssue' | 'updateLabels' | 'removeLabel' | 'updateAssigneeList'>;
    readonly graphqlProjectItemRepository: Pick<GraphqlProjectItemRepository, 'fetchProjectItems' | 'fetchProjectItemByUrl' | 'updateProjectField' | 'clearProjectField' | 'updateProjectTextField' | 'addIssueToProject'>;
    readonly localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
    readonly localStorageRepository: LocalStorageRepository;
    readonly ghToken: string;
    constructor(apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>, restIssueRepository: Pick<RestIssueRepository, 'createNewIssue' | 'updateIssue' | 'createComment' | 'getIssue' | 'updateLabels' | 'removeLabel' | 'updateAssigneeList'>, graphqlProjectItemRepository: Pick<GraphqlProjectItemRepository, 'fetchProjectItems' | 'fetchProjectItemByUrl' | 'updateProjectField' | 'clearProjectField' | 'updateProjectTextField' | 'addIssueToProject'>, localStorageCacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>, localStorageRepository: LocalStorageRepository, ghToken?: string);
    updateStatus: (project: Project, issue: Issue, statusId: string) => Promise<void>;
    convertProjectItemToIssue: (item: ProjectItem) => Issue;
    getAllIssuesFromCache: (cacheKey: string, allowCacheMinutes: number) => Promise<Issue[] | null>;
    getAllIssues: (projectId: Project["id"], allowCacheMinutes: number) => Promise<{
        issues: Issue[];
        cacheUsed: boolean;
    }>;
    getAllIssuesFromGitHub: (projectId: Project["id"]) => Promise<Issue[]>;
    createNewIssue: (org: string, repo: string, title: string, body: string, assignees: string[], labels: string[]) => Promise<number>;
    searchIssue: (query: {
        owner: string;
        repositoryName: string;
        type?: "issue" | "pr";
        state?: "open" | "closed" | "all";
        title?: string;
        createdFrom?: string;
        assignee?: string;
    }) => Promise<{
        url: string;
        title: string;
        number: string;
    }[]>;
    updateIssue: (issue: Issue) => Promise<void>;
    getIssueByUrl: (url: string) => Promise<Issue | null>;
    addIssueToProject: (project: Project, issueUrl: string) => Promise<void>;
    setDependedIssueUrl: (prUrl: string, project: Project, issueUrl: string) => Promise<void>;
    updateNextActionDate: (issueUrl: string, project: Project, date: Date) => Promise<void>;
    updateNextActionHour: (project: Project & {
        nextActionHour: NonNullable<Project["nextActionHour"]>;
    }, issue: Issue, hour: number) => Promise<void>;
    updateStory: (project: Project & {
        story: NonNullable<Project["story"]>;
    }, issue: Issue, storyOptionId: string) => Promise<void>;
    clearProjectField: (project: Project, fieldId: string, issue: Issue) => Promise<void>;
    createComment: (issue: Issue, comment: string) => Promise<void>;
    updateProjectTextField: (project: Project, fieldId: string, issue: Issue, text: string) => Promise<void>;
    updateLabels: (issue: Issue, labels: Issue["labels"]) => Promise<void>;
    removeLabel: (issue: Issue, label: string) => Promise<void>;
    updateAssigneeList: (issue: Issue, assigneeList: Member["name"][]) => Promise<void>;
    get: (_issueUrl: string, _project: Project) => Promise<Issue | null>;
    update: (issue: Issue, _project: Project) => Promise<void>;
    private parseIssueUrl;
    private computePrStatus;
    findRelatedOpenPRs: (issueUrl: string) => Promise<RelatedPullRequest[]>;
    getAllOpened: (project: Project, allowCacheMinutes: number) => Promise<Issue[]>;
    getStoryObjectMap: (project: Project, allowCacheMinutes: number) => Promise<StoryObjectMap>;
    getOpenPullRequest: (prUrl: string) => Promise<RelatedPullRequest | null>;
    closePullRequest: (prUrl: string) => Promise<void>;
    closeIssueByUrl: (issueUrl: string, stateReason: "completed" | "not_planned") => Promise<void>;
    getPullRequestChangedFilePaths: (prUrl: string) => Promise<string[]>;
    approvePullRequest: (prUrl: string) => Promise<void>;
    requestChangesWithInlineComment: (prUrl: string, changedFilePath: string | null, commentBody: string) => Promise<void>;
    private fetchPullRequestHeadSha;
    createPullRequestReviewComment: (prUrl: string, path: string, line: number, side: PullRequestReviewCommentSide, commentBody: string) => Promise<void>;
    private readGitHubErrorReason;
    private formatGitHubErrorWithStatus;
    deletePullRequestBranch: (prUrl: string, branchName: string) => Promise<void>;
    createCommentByUrl: (issueOrPrUrl: string, commentBody: string) => Promise<void>;
    getIssueOrPullRequestBody: (url: string) => Promise<string>;
    getIssueOrPullRequestComments: (url: string) => Promise<IssueComment[]>;
    getPullRequestDetail: (prUrl: string) => Promise<PullRequestDetail | null>;
    private fetchPullRequestFiles;
    getPullRequestCommits: (prUrl: string) => Promise<PullRequestCommit[]>;
    getIssueOrPullRequestState: (url: string) => Promise<{
        state: string;
        merged: boolean;
        isPullRequest: boolean;
    }>;
    getPullRequestSummary: (prUrl: string) => Promise<{
        title: string;
        body: string;
        additions: number;
        deletions: number;
        changedFiles: number;
    } | null>;
}
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.d.ts.map