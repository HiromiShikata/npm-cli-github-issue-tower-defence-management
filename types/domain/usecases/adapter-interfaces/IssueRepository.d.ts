import { Issue, Label } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
import { Member } from '../../entities/Member';
import { StoryObjectMap } from '../../entities/StoryObjectMap';
export type RelatedPullRequest = {
    url: string;
    branchName: string | null;
    createdAt: Date;
    isDraft: boolean;
    isConflicted: boolean;
    mergeable: string | null;
    isPassedAllCiJob: boolean;
    isCiStateSuccess: boolean;
    isResolvedAllReviewComments: boolean;
    isBranchOutOfDate: boolean;
    missingRequiredCheckNames: string[];
};
export type IssueComment = {
    author: string;
    body: string;
    createdAt: Date;
};
export type PullRequestFile = {
    filename: string;
    status: string;
    additions: number;
    deletions: number;
    patch: string | null;
};
export type PullRequestDetail = {
    title: string;
    state: string;
    merged: boolean;
    isDraft: boolean;
    additions: number;
    deletions: number;
    changedFiles: number;
    headRefName: string;
    baseRefName: string;
    author: string;
    files: PullRequestFile[];
};
export type PullRequestCommit = {
    sha: string;
    message: string;
    author: string;
    authoredAt: Date;
};
export type PullRequestReviewCommentSide = 'LEFT' | 'RIGHT';
export type PullRequestReviewInlineLocation = {
    line: number;
    side: PullRequestReviewCommentSide;
};
export interface IssueRepository {
    getAllIssues: (projectId: Project['id'], allowCacheMinutes: number) => Promise<{
        issues: Issue[];
        cacheUsed: boolean;
    }>;
    getIssueByUrl: (url: string) => Promise<Issue | null>;
    createNewIssue: (org: string, repo: string, title: string, body: string, assignees: Member['name'][], labels: Label[]) => Promise<number>;
    searchIssue: (query: {
        owner: string;
        repositoryName: string;
        type?: 'issue' | 'pr';
        state?: 'open' | 'closed' | 'all';
        title?: string;
        createdFrom?: string;
        assignee?: string;
    }) => Promise<{
        url: string;
        title: string;
        number: string;
    }[]>;
    updateIssue: (issue: Issue) => Promise<void>;
    updateNextActionDate: (issueUrl: string, project: Project, date: Date) => Promise<void>;
    updateNextActionHour: (project: Project & {
        nextActionHour: NonNullable<Project['nextActionHour']>;
    }, issue: Issue, hour: number) => Promise<void>;
    updateProjectTextField: (project: Project, fieldId: string, issue: Issue, text: string) => Promise<void>;
    updateStory: (project: Project & {
        story: NonNullable<Project['story']>;
    }, issue: Issue, storyId: FieldOption['id']) => Promise<void>;
    updateStatus: (project: Project, issue: Issue, statusId: string) => Promise<void>;
    clearProjectField: (project: Project, fieldId: string, issue: Issue) => Promise<void>;
    createComment: (issue: Issue, commentBody: string) => Promise<void>;
    updateLabels: (issue: Issue, labels: Issue['labels']) => Promise<void>;
    removeLabel: (issue: Issue, label: Label) => Promise<void>;
    updateAssigneeList: (issue: Issue, assigneeList: Member['name'][]) => Promise<void>;
    get: (issueUrl: string, project: Project) => Promise<Issue | null>;
    update: (issue: Issue, project: Project) => Promise<void>;
    findRelatedOpenPRs: (issueUrl: string) => Promise<RelatedPullRequest[]>;
    getOpenPullRequest: (prUrl: string) => Promise<RelatedPullRequest | null>;
    getPullRequestChangedFilePaths: (prUrl: string) => Promise<string[]>;
    approvePullRequest: (prUrl: string) => Promise<void>;
    requestChangesWithInlineComment: (prUrl: string, changedFilePath: string | null, commentBody: string, inlineCommentLocation?: PullRequestReviewInlineLocation | null) => Promise<void>;
    createPullRequestReviewComment: (prUrl: string, path: string, line: number, side: PullRequestReviewCommentSide, commentBody: string) => Promise<void>;
    closePullRequest: (prUrl: string) => Promise<void>;
    closeIssueByUrl: (issueUrl: string, stateReason: 'completed' | 'not_planned') => Promise<void>;
    deletePullRequestBranch: (prUrl: string, branchName: string) => Promise<void>;
    createCommentByUrl: (issueOrPrUrl: string, commentBody: string) => Promise<void>;
    getAllOpened: (project: Project, allowCacheMinutes: number) => Promise<Issue[]>;
    getStoryObjectMap: (project: Project, allowCacheMinutes: number) => Promise<StoryObjectMap>;
    addIssueToProject: (project: Project, issueUrl: string) => Promise<void>;
    setDependedIssueUrl: (prUrl: string, project: Project, issueUrl: string) => Promise<void>;
    getIssueOrPullRequestBody: (url: string) => Promise<string>;
    getIssueOrPullRequestComments: (url: string) => Promise<IssueComment[]>;
    getPullRequestDetail: (prUrl: string) => Promise<PullRequestDetail | null>;
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
//# sourceMappingURL=IssueRepository.d.ts.map