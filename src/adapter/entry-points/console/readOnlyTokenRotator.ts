import type { FieldOption, Project } from '../../../domain/entities/Project';
import type { Issue, Label } from '../../../domain/entities/Issue';
import type { Member } from '../../../domain/entities/Member';
import type {
  IssueRepository,
  PullRequestReviewCommentSide,
  PullRequestReviewInlineLocation,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import type { ConsoleGithubTokenResolver } from './consoleGithubTokenResolver';
import { createConsoleIssueRepositoryResolver } from './consoleGithubTokenResolver';

const withReadOnlyTokenRotation = async <T>(
  repositories: IssueRepository[],
  fn: (repo: IssueRepository) => Promise<T>,
): Promise<T> => {
  let lastError: Error | undefined;
  for (const repo of repositories) {
    try {
      return await fn(repo);
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw (
    lastError ?? new Error('readOnlyTokenRotator: no repositories provided')
  );
};

export const createReadOnlyTokenRotatingIssueRepository = (
  repositories: IssueRepository[],
): IssueRepository => {
  const primary = repositories[0];
  const rotate = <T>(fn: (repo: IssueRepository) => Promise<T>): Promise<T> =>
    withReadOnlyTokenRotation(repositories, fn);

  return {
    getAllIssues: (projectId: Project['id']) =>
      rotate((r) => r.getAllIssues(projectId)),
    getIssueByUrl: (url: string) => rotate((r) => r.getIssueByUrl(url)),
    getIssueBodyByUrl: (url: string) => rotate((r) => r.getIssueBodyByUrl(url)),
    searchIssue: (query: Parameters<IssueRepository['searchIssue']>[0]) =>
      rotate((r) => r.searchIssue(query)),
    searchIssues: (query: string) => rotate((r) => r.searchIssues(query)),
    get: (issueUrl: string, project: Project) =>
      rotate((r) => r.get(issueUrl, project)),
    getAllOpened: (project: Project) => rotate((r) => r.getAllOpened(project)),
    getStoryObjectMap: (project: Project) =>
      rotate((r) => r.getStoryObjectMap(project)),
    getAuthenticatedUserLogin: () =>
      rotate((r) => r.getAuthenticatedUserLogin()),
    findRelatedOpenPRs: (issueUrl: string) =>
      rotate((r) => r.findRelatedOpenPRs(issueUrl)),
    getOpenPullRequest: (prUrl: string) =>
      rotate((r) => r.getOpenPullRequest(prUrl)),
    getOpenPullRequestCiStatus: (prUrl: string) =>
      rotate((r) => r.getOpenPullRequestCiStatus(prUrl)),
    getOpenPullRequests: (prUrls: string[]) =>
      rotate((r) => r.getOpenPullRequests(prUrls)),
    getPullRequestChangedFilePaths: (prUrl: string) =>
      rotate((r) => r.getPullRequestChangedFilePaths(prUrl)),
    getIssueOrPullRequestBody: (url: string) =>
      rotate((r) => r.getIssueOrPullRequestBody(url)),
    getIssueOrPullRequestComments: (url: string) =>
      rotate((r) => r.getIssueOrPullRequestComments(url)),
    getPullRequestDetail: (prUrl: string) =>
      rotate((r) => r.getPullRequestDetail(prUrl)),
    getPullRequestCommits: (prUrl: string) =>
      rotate((r) => r.getPullRequestCommits(prUrl)),
    getIssueOrPullRequestState: (url: string) =>
      rotate((r) => r.getIssueOrPullRequestState(url)),
    getPullRequestSummary: (prUrl: string) =>
      rotate((r) => r.getPullRequestSummary(prUrl)),

    createNewIssue: (
      org: string,
      repo: string,
      title: string,
      body: string,
      assignees: Member['name'][],
      labels: Label[],
    ) => primary.createNewIssue(org, repo, title, body, assignees, labels),
    updateIssue: (issue: Issue) => primary.updateIssue(issue),
    updateIssueBody: (
      issue: Pick<Issue, 'org' | 'repo' | 'number'>,
      body: string,
    ) => primary.updateIssueBody(issue, body),
    updateNextActionDate: (
      issueUrl: string,
      project: Project,
      date: Date,
      projectItemId?: string,
    ) => primary.updateNextActionDate(issueUrl, project, date, projectItemId),
    updateNextActionHour: (
      project: Project & {
        nextActionHour: NonNullable<Project['nextActionHour']>;
      },
      issue: Issue,
      hour: number,
    ) => primary.updateNextActionHour(project, issue, hour),
    updateProjectTextField: (
      project: Project,
      fieldId: string,
      issue: Issue,
      text: string,
    ) => primary.updateProjectTextField(project, fieldId, issue, text),
    updateStory: (
      project: Project & { story: NonNullable<Project['story']> },
      issue: Issue,
      storyId: FieldOption['id'],
    ) => primary.updateStory(project, issue, storyId),
    updateStoryOptionColor: (
      project: Project & { story: NonNullable<Project['story']> },
      storyOptionId: string,
      newColor: FieldOption['color'],
    ) => primary.updateStoryOptionColor(project, storyOptionId, newColor),
    updateStatus: (project: Project, issue: Issue, statusId: string) =>
      primary.updateStatus(project, issue, statusId),
    clearProjectField: (project: Project, fieldId: string, issue: Issue) =>
      primary.clearProjectField(project, fieldId, issue),
    createComment: (issue: Issue, commentBody: string) =>
      primary.createComment(issue, commentBody),
    updateLabels: (issue: Issue, labels: Issue['labels']) =>
      primary.updateLabels(issue, labels),
    removeLabel: (issue: Issue, label: Label) =>
      primary.removeLabel(issue, label),
    getOrCreateLabel: (org: string, repo: string, labelName: string) =>
      primary.getOrCreateLabel(org, repo, labelName),
    updateAssigneeList: (
      issue: Pick<Issue, 'org' | 'repo' | 'number'>,
      assigneeList: Member['name'][],
    ) => primary.updateAssigneeList(issue, assigneeList),
    update: (issue: Issue, project: Project) => primary.update(issue, project),
    approvePullRequest: (prUrl: string) => primary.approvePullRequest(prUrl),
    mergePullRequest: (prUrl: string) => primary.mergePullRequest(prUrl),
    requestChangesWithInlineComment: (
      prUrl: string,
      changedFilePath: string | null,
      commentBody: string,
      inlineCommentLocation?: PullRequestReviewInlineLocation | null,
    ) =>
      primary.requestChangesWithInlineComment(
        prUrl,
        changedFilePath,
        commentBody,
        inlineCommentLocation,
      ),
    createPullRequestReviewComment: (
      prUrl: string,
      path: string,
      line: number,
      side: PullRequestReviewCommentSide,
      commentBody: string,
    ) =>
      primary.createPullRequestReviewComment(
        prUrl,
        path,
        line,
        side,
        commentBody,
      ),
    closePullRequest: (prUrl: string) => primary.closePullRequest(prUrl),
    closeIssueByUrl: (
      issueUrl: string,
      stateReason: 'completed' | 'not_planned',
    ) => primary.closeIssueByUrl(issueUrl, stateReason),
    deletePullRequestBranch: (prUrl: string, branchName: string) =>
      primary.deletePullRequestBranch(prUrl, branchName),
    createCommentByUrl: (issueOrPrUrl: string, commentBody: string) =>
      primary.createCommentByUrl(issueOrPrUrl, commentBody),
    addIssueToProject: (project: Project, issueUrl: string) =>
      primary.addIssueToProject(project, issueUrl),
    setDependedIssueUrl: (prUrl: string, project: Project, issueUrl: string) =>
      primary.setDependedIssueUrl(prUrl, project, issueUrl),
    setIssueAgentField: (
      issueUrl: string,
      project: Project,
      agentOptionId: string,
    ) => primary.setIssueAgentField(issueUrl, project, agentOptionId),
    updateBranch: (prUrl: string) => primary.updateBranch(prUrl),
    deleteAllCommentsByUrl: (issueOrPrUrl: string) =>
      primary.deleteAllCommentsByUrl(issueOrPrUrl),
  };
};

export const buildReadIssueRepositoryResolver = (
  readOnlyGithubTokens: string[] | undefined,
  buildIssueRepositoryForToken: (token: string) => IssueRepository,
  resolveGithubToken: ConsoleGithubTokenResolver,
): ((url: string) => IssueRepository) => {
  if (readOnlyGithubTokens && readOnlyGithubTokens.length > 0) {
    const repositories = readOnlyGithubTokens.map((token) =>
      buildIssueRepositoryForToken(token),
    );
    const rotatingRepo =
      createReadOnlyTokenRotatingIssueRepository(repositories);
    return (_url: string) => rotatingRepo;
  }
  return createConsoleIssueRepositoryResolver<IssueRepository>(
    resolveGithubToken,
    buildIssueRepositoryForToken,
  );
};
