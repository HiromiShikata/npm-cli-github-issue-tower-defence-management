import { HTTPError } from 'ky';
import type { FieldOption, Project } from '../../../domain/entities/Project';
import type { Issue, Label } from '../../../domain/entities/Issue';
import type { Member } from '../../../domain/entities/Member';
import type {
  IssueRepository,
  PullRequestReviewCommentSide,
  PullRequestReviewInlineLocation,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { GitHubConfirmedNotFoundError } from '../../../domain/usecases/ClearDependedIssueURLUseCase';
import { GitHubRateLimitError } from '../../repositories/issue/githubRateLimitRetry';
import type { ConsoleGithubTokenResolver } from './consoleGithubTokenResolver';
import {
  createConsoleIssueRepositoryResolver,
  extractRepositoryOwner,
} from './consoleGithubTokenResolver';

const isForbiddenOrNotFoundError = (error: unknown): boolean =>
  (error instanceof HTTPError &&
    (error.response.status === 403 || error.response.status === 404)) ||
  error instanceof GitHubConfirmedNotFoundError ||
  (error instanceof Error && /\bHTTP 40[34]\b/.test(error.message));

const withReadOnlyTokenRotationFallingBackToWriteRepository = async <T>(
  readRepositories: IssueRepository[],
  writeRepository: IssueRepository,
  fn: (repo: IssueRepository) => Promise<T>,
): Promise<T> => {
  let lastError: Error | undefined;
  for (const readRepository of readRepositories) {
    let result: T;
    try {
      result = await fn(readRepository);
    } catch (error) {
      if (error instanceof GitHubRateLimitError) {
        lastError = error;
        continue;
      }
      if (isForbiddenOrNotFoundError(error)) {
        return fn(writeRepository);
      }
      throw error;
    }
    if (result === null) {
      return fn(writeRepository);
    }
    return result;
  }
  throw (
    lastError ?? new Error('readOnlyTokenRotator: no repositories provided')
  );
};

export const createReadOnlyTokenRotatingIssueRepository = (
  readRepositories: IssueRepository[],
  writeRepository: IssueRepository,
): IssueRepository => {
  const rotate = <T>(fn: (repo: IssueRepository) => Promise<T>): Promise<T> =>
    withReadOnlyTokenRotationFallingBackToWriteRepository(
      readRepositories,
      writeRepository,
      fn,
    );

  return {
    getAllIssues: (projectId: Project['id']) =>
      rotate((r) => r.getAllIssues(projectId)),
    appendIssueToProjectCache: (projectId: Project['id'], issue: Issue) =>
      writeRepository.appendIssueToProjectCache(projectId, issue),
    removeIssueFromProjectCache: (projectId: Project['id'], issue: Issue) =>
      writeRepository.removeIssueFromProjectCache(projectId, issue),
    getIssueByUrl: (url: string, options?: { bypassCache?: boolean }) =>
      rotate((r) => r.getIssueByUrl(url, options)),
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
      writeRepository.getAuthenticatedUserLogin(),
    findRelatedOpenPRs: (
      issueUrl: string,
      options?: { bypassCache?: boolean },
    ) =>
      rotate((r) =>
        options !== undefined
          ? r.findRelatedOpenPRs(issueUrl, options)
          : r.findRelatedOpenPRs(issueUrl),
      ),
    findRelatedOpenPrUrls: (issueUrls: string[]) =>
      rotate((r) => r.findRelatedOpenPrUrls(issueUrls)),
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
    getIssueOrPullRequestComments: (
      ...args: Parameters<IssueRepository['getIssueOrPullRequestComments']>
    ) => rotate((r) => r.getIssueOrPullRequestComments(...args)),
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
    ) =>
      writeRepository.createNewIssue(org, repo, title, body, assignees, labels),
    updateIssue: (issue: Issue) => writeRepository.updateIssue(issue),
    updateIssueBody: (
      issue: Pick<Issue, 'org' | 'repo' | 'number'>,
      body: string,
    ) => writeRepository.updateIssueBody(issue, body),
    updateIssueCommentBody: (
      comment: Pick<Issue, 'org' | 'repo'> & { commentId: number },
      body: string,
    ) => writeRepository.updateIssueCommentBody(comment, body),
    updateNextActionDate: (
      issueUrl: string,
      project: Project,
      date: Date,
      projectItemId?: string,
    ) =>
      writeRepository.updateNextActionDate(
        issueUrl,
        project,
        date,
        projectItemId,
      ),
    updateNextActionHour: (
      project: Project & {
        nextActionHour: NonNullable<Project['nextActionHour']>;
      },
      issue: Issue,
      hour: number,
    ) => writeRepository.updateNextActionHour(project, issue, hour),
    updateProjectTextField: (
      project: Project,
      fieldId: string,
      issue: Issue,
      text: string,
    ) => writeRepository.updateProjectTextField(project, fieldId, issue, text),
    updateStory: (
      project: Project & { story: NonNullable<Project['story']> },
      issue: Issue,
      storyId: FieldOption['id'],
    ) => writeRepository.updateStory(project, issue, storyId),
    updateStoryOptionColor: (
      project: Project & { story: NonNullable<Project['story']> },
      storyOptionId: string,
      newColor: FieldOption['color'],
    ) =>
      writeRepository.updateStoryOptionColor(project, storyOptionId, newColor),
    updateStatus: (project: Project, issue: Issue, statusId: string) =>
      writeRepository.updateStatus(project, issue, statusId),
    clearProjectField: (project: Project, fieldId: string, issue: Issue) =>
      writeRepository.clearProjectField(project, fieldId, issue),
    createComment: (issue: Issue, commentBody: string) =>
      writeRepository.createComment(issue, commentBody),
    updateLabels: (issue: Issue, labels: Issue['labels']) =>
      writeRepository.updateLabels(issue, labels),
    removeLabel: (issue: Issue, label: Label) =>
      writeRepository.removeLabel(issue, label),
    getOrCreateLabel: (org: string, repo: string, labelName: string) =>
      writeRepository.getOrCreateLabel(org, repo, labelName),
    updateAssigneeList: (
      issue: Pick<Issue, 'org' | 'repo' | 'number'>,
      assigneeList: Member['name'][],
    ) => writeRepository.updateAssigneeList(issue, assigneeList),
    update: (issue: Issue, project: Project) =>
      writeRepository.update(issue, project),
    approvePullRequest: (prUrl: string) =>
      writeRepository.approvePullRequest(prUrl),
    mergePullRequest: (prUrl: string) =>
      writeRepository.mergePullRequest(prUrl),
    requestChangesWithInlineComment: (
      prUrl: string,
      changedFilePath: string | null,
      commentBody: string,
      inlineCommentLocation?: PullRequestReviewInlineLocation | null,
    ) =>
      writeRepository.requestChangesWithInlineComment(
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
      writeRepository.createPullRequestReviewComment(
        prUrl,
        path,
        line,
        side,
        commentBody,
      ),
    closePullRequest: (prUrl: string) =>
      writeRepository.closePullRequest(prUrl),
    closeIssueByUrl: (
      issueUrl: string,
      stateReason: 'completed' | 'not_planned',
    ) => writeRepository.closeIssueByUrl(issueUrl, stateReason),
    reopenIssueByUrl: (issueUrl: string) =>
      writeRepository.reopenIssueByUrl(issueUrl),
    getLatestReopenedEventAt: (issue: Issue) =>
      rotate((r) => r.getLatestReopenedEventAt(issue)),
    deletePullRequestBranch: (prUrl: string, branchName: string) =>
      writeRepository.deletePullRequestBranch(prUrl, branchName),
    createCommentByUrl: (issueOrPrUrl: string, commentBody: string) =>
      writeRepository.createCommentByUrl(issueOrPrUrl, commentBody),
    addIssueToProject: (project: Project, issueUrl: string) =>
      writeRepository.addIssueToProject(project, issueUrl),
    removeIssueFromProject: (project: Project, issueUrl: string) =>
      writeRepository.removeIssueFromProject(project, issueUrl),
    updateStoryByProjectItemId: (
      project: Project & { story: NonNullable<Project['story']> },
      projectItemId: string,
      storyOptionId: string,
    ) =>
      writeRepository.updateStoryByProjectItemId(
        project,
        projectItemId,
        storyOptionId,
      ),
    setDependedIssueUrl: (prUrl: string, project: Project, issueUrl: string) =>
      writeRepository.setDependedIssueUrl(prUrl, project, issueUrl),
    setIssueAgentField: (
      issueUrl: string,
      project: Project,
      agentOptionId: string,
    ) => writeRepository.setIssueAgentField(issueUrl, project, agentOptionId),
    updateBranch: (prUrl: string) => writeRepository.updateBranch(prUrl),
    deleteAllCommentsByUrl: (issueOrPrUrl: string) =>
      writeRepository.deleteAllCommentsByUrl(issueOrPrUrl),
  };
};

export const buildReadIssueRepositoryResolver = async (
  githubAppPrivateKeyPathsByProject: Record<string, string[]> | undefined,
  mintTokens: (paths: string[]) => Promise<string[]>,
  buildIssueRepositoryForToken: (token: string) => IssueRepository,
  resolveGithubToken: ConsoleGithubTokenResolver,
  resolveProjectName: (repositoryOwner: string) => string | null,
): Promise<(url: string) => IssueRepository> => {
  const ownTokenIssueRepositoryResolver =
    createConsoleIssueRepositoryResolver<IssueRepository>(
      resolveGithubToken,
      buildIssueRepositoryForToken,
    );
  const appTokenReadRepositoriesByProject = new Map<
    string,
    IssueRepository[]
  >();
  for (const [projectName, keyPaths] of Object.entries(
    githubAppPrivateKeyPathsByProject ?? {},
  )) {
    if (keyPaths.length === 0) {
      continue;
    }
    const tokens = await mintTokens(keyPaths);
    if (tokens.length > 0) {
      appTokenReadRepositoriesByProject.set(
        projectName,
        tokens.map((token) => buildIssueRepositoryForToken(token)),
      );
    }
  }
  if (appTokenReadRepositoriesByProject.size === 0) {
    return ownTokenIssueRepositoryResolver;
  }
  return (url: string): IssueRepository => {
    const ownTokenIssueRepository = ownTokenIssueRepositoryResolver(url);
    const repositoryOwner = extractRepositoryOwner(url);
    const projectName =
      repositoryOwner === null ? null : resolveProjectName(repositoryOwner);
    const appTokenReadRepositories =
      projectName === null
        ? undefined
        : appTokenReadRepositoriesByProject.get(projectName);
    if (appTokenReadRepositories === undefined) {
      return ownTokenIssueRepository;
    }
    return createReadOnlyTokenRotatingIssueRepository(
      appTokenReadRepositories,
      ownTokenIssueRepository,
    );
  };
};
