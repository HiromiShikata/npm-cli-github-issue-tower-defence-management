import {
  IssueRepository,
  RelatedPullRequest,
  IssueComment,
  PullRequestDetail,
  PullRequestFile,
  PullRequestCommit,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { StoryObjectMap } from '../../../domain/entities/StoryObjectMap';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import {
  GraphqlProjectItemRepository,
  ProjectItem,
} from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import typia from 'typia';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { normalizeFieldName } from '../utils';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { Member } from '../../../domain/entities/Member';

type TimelineItem = {
  __typename: string;
  willCloseTarget?: boolean;
  source?: {
    __typename: string;
    url?: string;
    number?: number;
    state?: string;
    createdAt?: string;
    isDraft?: boolean;
    mergeable?: string;
    headRefName?: string;
    baseRefName?: string;
    baseRepository?: {
      branchProtectionRules?: {
        nodes: Array<{
          pattern: string;
          requiredStatusCheckContexts: string[];
        }>;
      };
      defaultBranchRef?: {
        name: string;
      } | null;
      rulesets?: {
        nodes: Array<{
          name: string;
          enforcement: string;
          conditions: {
            refName: {
              include: string[];
              exclude: string[];
            };
          };
          rules: {
            nodes: Array<{
              type: string;
              parameters:
                | {
                    requiredStatusChecks: Array<{
                      context: string;
                    }>;
                  }
                | Record<string, never>;
            }>;
          };
        }>;
      };
    };
    commits?: {
      nodes: Array<{
        commit: {
          statusCheckRollup?: {
            state: string;
            contexts?: {
              nodes: Array<
                | {
                    __typename: 'CheckRun';
                    name: string;
                    conclusion: string | null;
                  }
                | {
                    __typename: 'StatusContext';
                    context: string;
                    state: string;
                  }
              >;
            };
          } | null;
        };
      }>;
    };
    reviewThreads?: {
      nodes: Array<{
        isResolved: boolean;
      }>;
    };
    baseRef?: {
      name: string;
    } | null;
  };
};

type IssueTimelineResponse = {
  data?: {
    repository?: {
      issue?: {
        timelineItems: {
          pageInfo: {
            endCursor: string;
            hasNextPage: boolean;
          };
          nodes: TimelineItem[];
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

type PrStatusComputationData = {
  isDraft?: boolean;
  mergeable?: string;
  baseRepository?: {
    branchProtectionRules?: {
      nodes: Array<{
        pattern: string;
        requiredStatusCheckContexts: string[];
      }>;
    };
    defaultBranchRef?: {
      name: string;
    } | null;
    rulesets?: {
      nodes: Array<{
        name: string;
        enforcement: string;
        conditions: {
          refName: {
            include: string[];
            exclude: string[];
          };
        };
        rules: {
          nodes: Array<{
            type: string;
            parameters:
              | {
                  requiredStatusChecks: Array<{
                    context: string;
                  }>;
                }
              | Record<string, never>;
          }>;
        };
      }>;
    };
  };
  commits?: {
    nodes: Array<{
      commit: {
        statusCheckRollup?: {
          state: string;
          contexts?: {
            nodes: Array<
              | {
                  __typename: 'CheckRun';
                  name: string;
                  conclusion: string | null;
                }
              | {
                  __typename: 'StatusContext';
                  context: string;
                  state: string;
                }
            >;
          };
        } | null;
      };
    }>;
  };
  reviewThreads?: {
    nodes: Array<{
      isResolved: boolean;
    }>;
  };
};

type DirectPullRequestResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        url: string;
        state: string;
        headRefName?: string;
        baseRefName?: string;
      } & PrStatusComputationData;
    };
  };
  errors?: Array<{ message: string }>;
};

function isIssueTimelineResponse(
  value: unknown,
): value is IssueTimelineResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

function isDirectPullRequestResponse(
  value: unknown,
): value is DirectPullRequestResponse {
  if (typeof value !== 'object' || value === null) return false;
  return true;
}

type PullRequestFilesResponseItem = {
  filename: string;
};

function isPullRequestFilesResponse(
  value: unknown,
): value is PullRequestFilesResponseItem[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) => typeof item === 'object' && item !== null && 'filename' in item,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isLoginContainer(value: unknown): value is { login: string } {
  return isRecord(value) && typeof value.login === 'string';
}

function isRefContainer(value: unknown): value is { ref: string } {
  return isRecord(value) && typeof value.ref === 'string';
}

type IssueOrPullRequestBodyResponse = {
  body: string | null;
};

function isIssueOrPullRequestBodyResponse(
  value: unknown,
): value is IssueOrPullRequestBodyResponse {
  return isRecord(value) && isNullableString(value.body);
}

type IssueOrPullRequestStateResponse = {
  state: string;
};

function isIssueOrPullRequestStateResponse(
  value: unknown,
): value is IssueOrPullRequestStateResponse {
  return isRecord(value) && typeof value.state === 'string';
}

type IssueCommentsResponseItem = {
  user: { login: string } | null;
  body: string | null;
  created_at: string;
};

function isIssueCommentsResponseItem(
  value: unknown,
): value is IssueCommentsResponseItem {
  if (!isRecord(value)) return false;
  const userValid = value.user === null || isLoginContainer(value.user);
  return (
    userValid &&
    isNullableString(value.body) &&
    typeof value.created_at === 'string'
  );
}

function isIssueCommentsResponse(
  value: unknown,
): value is IssueCommentsResponseItem[] {
  return Array.isArray(value) && value.every(isIssueCommentsResponseItem);
}

type PullRequestDetailResponse = {
  title: string;
  state: string;
  merged: boolean;
  draft: boolean;
  additions: number;
  deletions: number;
  changed_files: number;
  head: { ref: string };
  base: { ref: string };
  user: { login: string } | null;
  body: string | null;
};

function isPullRequestDetailResponse(
  value: unknown,
): value is PullRequestDetailResponse {
  if (!isRecord(value)) return false;
  const userValid = value.user === null || isLoginContainer(value.user);
  return (
    typeof value.title === 'string' &&
    typeof value.state === 'string' &&
    typeof value.merged === 'boolean' &&
    typeof value.draft === 'boolean' &&
    typeof value.additions === 'number' &&
    typeof value.deletions === 'number' &&
    typeof value.changed_files === 'number' &&
    isRefContainer(value.head) &&
    isRefContainer(value.base) &&
    userValid &&
    isNullableString(value.body)
  );
}

type PullRequestDetailFilesResponseItem = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

function isPullRequestDetailFilesResponseItem(
  value: unknown,
): value is PullRequestDetailFilesResponseItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.filename === 'string' &&
    typeof value.status === 'string' &&
    typeof value.additions === 'number' &&
    typeof value.deletions === 'number' &&
    (value.patch === undefined || typeof value.patch === 'string')
  );
}

function isPullRequestDetailFilesResponse(
  value: unknown,
): value is PullRequestDetailFilesResponseItem[] {
  return (
    Array.isArray(value) && value.every(isPullRequestDetailFilesResponseItem)
  );
}

type PullRequestCommitsResponseItem = {
  sha: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
  };
};

function isCommitAuthor(
  value: unknown,
): value is { name: string; date: string } {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.date === 'string'
  );
}

function isPullRequestCommitsResponseItem(
  value: unknown,
): value is PullRequestCommitsResponseItem {
  if (!isRecord(value)) return false;
  if (typeof value.sha !== 'string') return false;
  if (!isRecord(value.commit)) return false;
  if (typeof value.commit.message !== 'string') return false;
  return value.commit.author === null || isCommitAuthor(value.commit.author);
}

function isPullRequestCommitsResponse(
  value: unknown,
): value is PullRequestCommitsResponseItem[] {
  return Array.isArray(value) && value.every(isPullRequestCommitsResponseItem);
}

const fnmatch = (pattern: string, str: string): boolean => {
  let regexStr = '^';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === '*') {
      if (pattern[i + 1] === '*') {
        regexStr += '.*';
        i += 2;
        if (pattern[i] === '/') {
          i++;
        }
      } else {
        regexStr += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      regexStr += '[^/]';
      i++;
    } else if (c === '[') {
      let j = i + 1;
      while (j < pattern.length && pattern[j] !== ']') {
        j++;
      }
      if (j >= pattern.length) {
        regexStr += '\\[';
        i++;
        continue;
      }
      const content = pattern.slice(i + 1, j);
      if (content.length > 0 && (content[0] === '!' || content[0] === '^')) {
        const body = content.slice(1).replace(/\\/g, '\\\\');
        regexStr += '[^' + body + ']';
      } else {
        const escapedContent = content.replace(/\\/g, '\\\\');
        regexStr += '[' + escapedContent + ']';
      }
      i = j + 1;
    } else {
      regexStr += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  regexStr += '$';
  try {
    const regex = new RegExp(regexStr);
    return regex.test(str);
  } catch {
    return pattern === str;
  }
};

export class ApiV3CheerioRestIssueRepository
  extends BaseGitHubRepository
  implements IssueRepository
{
  constructor(
    readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>,
    readonly restIssueRepository: Pick<
      RestIssueRepository,
      | 'createNewIssue'
      | 'updateIssue'
      | 'createComment'
      | 'getIssue'
      | 'updateLabels'
      | 'removeLabel'
      | 'updateAssigneeList'
    >,
    readonly graphqlProjectItemRepository: Pick<
      GraphqlProjectItemRepository,
      | 'fetchProjectItems'
      | 'fetchProjectItemByUrl'
      | 'updateProjectField'
      | 'clearProjectField'
      | 'updateProjectTextField'
      | 'addIssueToProject'
    >,
    readonly localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
    readonly localStorageRepository: LocalStorageRepository,
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
  ) {
    super(localStorageRepository, ghToken);
  }

  updateStatus: (
    project: Project,
    issue: Issue,
    statusId: string,
  ) => Promise<void> = async (project, issue, statusId) => {
    await this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.status.fieldId,
      issue.itemId,
      { singleSelectOptionId: statusId },
    );
  };

  convertProjectItemToIssue = (item: ProjectItem): Issue => {
    const nextActionDate = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactiondate',
    )?.value;
    const nextActionHour = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactionhour',
    )?.value;
    const estimationMinutes = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'estimationminutes',
    )?.value;
    const dependedIssueUrls =
      item.customFields
        .find((field) =>
          normalizeFieldName(field.name).startsWith('dependedissueurls'),
        )
        ?.value?.split(',')
        .map((url) => url.trim())
        .filter((url) => url.length > 0) || [];
    const completionDate50PercentConfidence = item.customFields.find((field) =>
      normalizeFieldName(field.name).startsWith('completiondate50'),
    )?.value;
    const story = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'story',
    )?.value;
    const status = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'status',
    )?.value;
    const { owner, repo } = this.extractIssueFromUrl(item.url);

    return {
      nameWithOwner: item.nameWithOwner,
      url: item.url,
      title: item.title,
      number: item.number,
      state: item.state,
      labels: item.labels,
      assignees: item.assignees,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      nextActionHour: nextActionHour ? parseInt(nextActionHour) : null,
      estimationMinutes: estimationMinutes ? parseInt(estimationMinutes) : null,
      dependedIssueUrls: dependedIssueUrls,
      completionDate50PercentConfidence: completionDate50PercentConfidence
        ? new Date(completionDate50PercentConfidence)
        : null,
      status: status || null,
      story: story || null,
      org: owner,
      repo: repo,
      body: item.body ?? '',
      itemId: item.id,
      isPr: item.url.includes('/pull/'),
      isInProgress: normalizeFieldName(status || '').includes('progress'),
      isClosed: item.state !== 'OPEN',
      createdAt: new Date(item.createdAt || '2000-01-01'),
      author: item.author,
    };
  };
  getAllIssuesFromCache = async (
    cacheKey: string,
    allowCacheMinutes: number,
  ): Promise<Issue[] | null> => {
    const cache = await this.localStorageCacheRepository.getLatest(cacheKey);
    if (cache) {
      const now = new Date();
      const cacheTimestamp = cache.timestamp;
      const diff = now.getTime() - cacheTimestamp.getTime();
      if (diff < allowCacheMinutes * 60 * 1000) {
        if (!Array.isArray(cache.value)) {
          return null;
        }
        const issues = cache.value
          .filter(
            (issue: unknown): issue is object => typeof issue === 'object',
          )
          .map((issue: object): object => {
            const nextActionDate =
              !('nextActionDate' in issue) ||
              typeof issue.nextActionDate !== 'string' ||
              issue.nextActionDate === null
                ? null
                : new Date(issue.nextActionDate);
            const completionDate50PercentConfidence =
              !('completionDate50PercentConfidence' in issue) ||
              typeof issue.completionDate50PercentConfidence !== 'string'
                ? null
                : new Date(issue.completionDate50PercentConfidence);
            const createdAt =
              !('createdAt' in issue) || typeof issue.createdAt !== 'string'
                ? new Date()
                : new Date(issue.createdAt);

            return {
              ...issue,
              nextActionDate: nextActionDate,
              completionDate50PercentConfidence:
                completionDate50PercentConfidence,
              createdAt: createdAt,
            };
          });

        if (typia.is<Issue[]>(issues)) {
          return issues;
        }
      }
    }
    return null;
  };

  getAllIssues = async (
    projectId: Project['id'],
    allowCacheMinutes: number,
  ): Promise<{
    issues: Issue[];
    cacheUsed: boolean;
  }> => {
    const cacheKey = `allIssues-${projectId}`;
    const cachedIssues = await this.getAllIssuesFromCache(
      cacheKey,
      allowCacheMinutes,
    );
    if (cachedIssues) {
      return { issues: cachedIssues, cacheUsed: true };
    }
    const issues = await this.getAllIssuesFromGitHub(projectId);
    await this.localStorageCacheRepository.set(cacheKey, issues);
    return { issues, cacheUsed: false };
  };
  getAllIssuesFromGitHub = async (
    projectId: Project['id'],
  ): Promise<Issue[]> => {
    const items =
      await this.graphqlProjectItemRepository.fetchProjectItems(projectId);
    return items.map((item) => this.convertProjectItemToIssue(item));
  };
  createNewIssue = async (
    org: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<number> => {
    return await this.restIssueRepository.createNewIssue(
      org,
      repo,
      title,
      body,
      assignees,
      labels,
    );
  };
  searchIssue = async (query: {
    owner: string;
    repositoryName: string;
    type?: 'issue' | 'pr';
    state?: 'open' | 'closed' | 'all';
    title?: string;
    createdFrom?: string;
    assignee?: string;
  }): Promise<
    {
      url: string;
      title: string;
      number: string;
    }[]
  > => {
    return await this.apiV3IssueRepository.searchIssue(query);
  };
  updateIssue = async (issue: Issue): Promise<void> => {
    await this.restIssueRepository.updateIssue(issue);
  };
  getIssueByUrl = async (url: string): Promise<Issue | null> => {
    const projectItem =
      await this.graphqlProjectItemRepository.fetchProjectItemByUrl(url);
    if (!projectItem) {
      return null;
    }
    return this.convertProjectItemToIssue(projectItem);
  };
  addIssueToProject = async (
    project: Project,
    issueUrl: string,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.addIssueToProject(
      project.id,
      issueUrl,
    );
  };
  setDependedIssueUrl = async (
    prUrl: string,
    project: Project,
    issueUrl: string,
  ): Promise<void> => {
    const dependedIssueUrlField = project.dependedIssueUrlSeparatedByComma;
    if (!dependedIssueUrlField) {
      return;
    }
    const existingProjectItem =
      await this.graphqlProjectItemRepository.fetchProjectItemByUrl(
        prUrl,
        project.id,
      );
    const existingValue = existingProjectItem?.customFields.find(
      (field) => field.name === dependedIssueUrlField.name,
    )?.value;
    if (existingValue) {
      return;
    }
    const projectItemId =
      existingProjectItem?.id ??
      (await this.graphqlProjectItemRepository.addIssueToProject(
        project.id,
        prUrl,
      ));
    await this.graphqlProjectItemRepository.updateProjectTextField(
      project.id,
      dependedIssueUrlField.fieldId,
      projectItemId,
      issueUrl,
    );
  };

  updateNextActionDate = async (
    issueUrl: string,
    project: Project,
    date: Date,
  ): Promise<void> => {
    if (!project.nextActionDate) {
      return;
    }
    const projectItem =
      await this.graphqlProjectItemRepository.fetchProjectItemByUrl(
        issueUrl,
        project.id,
      );
    if (!projectItem) {
      return;
    }
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.nextActionDate.fieldId,
      projectItem.id,
      { date: date.toISOString().split('T')[0] },
    );
  };
  updateNextActionHour = async (
    project: Project & {
      nextActionHour: NonNullable<Project['nextActionHour']>;
    },
    issue: Issue,
    hour: number,
  ): Promise<void> => {
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.nextActionHour.fieldId,
      issue.itemId,
      { number: hour },
    );
  };
  updateStory = async (
    project: Project & { story: NonNullable<Project['story']> },
    issue: Issue,
    storyOptionId: string,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.story.fieldId,
      issue.itemId,
      { singleSelectOptionId: storyOptionId },
    );
  };
  clearProjectField = async (
    project: Project,
    fieldId: string,
    issue: Issue,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.clearProjectField(
      project.id,
      fieldId,
      issue.itemId,
    );
    return;
  };
  createComment = async (issue: Issue, comment: string): Promise<void> => {
    await this.restIssueRepository.createComment(issue.url, comment);
  };
  updateProjectTextField = async (
    project: Project,
    fieldId: string,
    issue: Issue,
    text: string,
  ): Promise<void> => {
    await this.graphqlProjectItemRepository.updateProjectTextField(
      project.id,
      fieldId,
      issue.itemId,
      text,
    );
  };

  updateLabels = (issue: Issue, labels: Issue['labels']): Promise<void> => {
    return this.restIssueRepository.updateLabels(issue, labels);
  };
  removeLabel = (issue: Issue, label: string): Promise<void> => {
    return this.restIssueRepository.removeLabel(issue, label);
  };
  updateAssigneeList = (
    issue: Issue,
    assigneeList: Member['name'][],
  ): Promise<void> => {
    return this.restIssueRepository.updateAssigneeList(issue, assigneeList);
  };
  get = async (_issueUrl: string, _project: Project): Promise<Issue | null> => {
    return this.getIssueByUrl(_issueUrl);
  };
  update = async (issue: Issue, _project: Project): Promise<void> => {
    await this.updateIssue(issue);
  };
  private parseIssueUrl = (
    issueUrl: string,
  ): {
    owner: string;
    repo: string;
    issueNumber: number;
    isPr: boolean;
  } => {
    const urlMatch = issueUrl.match(
      /github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/,
    );
    if (!urlMatch) {
      throw new Error(`Invalid GitHub issue URL: ${issueUrl}`);
    }
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      issueNumber: parseInt(urlMatch[4], 10),
      isPr: urlMatch[3] === 'pull',
    };
  };

  private computePrStatus = (
    prUrl: string,
    headRefName: string | undefined,
    baseRefName: string | undefined,
    data: PrStatusComputationData,
  ): RelatedPullRequest => {
    const isConflicted = data.mergeable === 'CONFLICTING';
    const lastCommit = data.commits?.nodes[0]?.commit;
    const ciState = lastCommit?.statusCheckRollup?.state;
    const contexts = lastCommit?.statusCheckRollup?.contexts?.nodes || [];

    const branchProtectionRules =
      data.baseRepository?.branchProtectionRules?.nodes || [];
    const matchingRules = baseRefName
      ? branchProtectionRules.filter(
          (rule) =>
            rule.pattern === baseRefName || fnmatch(rule.pattern, baseRefName),
        )
      : [];
    const requiredCheckNamesSet = new Set<string>();
    for (const rule of matchingRules) {
      for (const name of rule.requiredStatusCheckContexts) {
        requiredCheckNamesSet.add(name);
      }
    }

    const rulesets = data.baseRepository?.rulesets?.nodes || [];
    const defaultBranchName = data.baseRepository?.defaultBranchRef?.name || '';
    for (const ruleset of rulesets) {
      if (ruleset.enforcement !== 'ACTIVE') continue;
      const refIncludes = ruleset.conditions.refName.include;
      const refExcludes = ruleset.conditions.refName.exclude;
      const matchesInclude =
        baseRefName !== undefined &&
        refIncludes.some((pattern) => {
          if (pattern === '~DEFAULT_BRANCH') {
            return baseRefName === defaultBranchName;
          }
          if (pattern === '~ALL') {
            return true;
          }
          const branchPattern = pattern.replace(/^refs\/heads\//, '');
          return (
            branchPattern === baseRefName || fnmatch(branchPattern, baseRefName)
          );
        });
      if (!matchesInclude) continue;
      const matchesExclude =
        baseRefName !== undefined &&
        refExcludes.some((pattern) => {
          if (pattern === '~DEFAULT_BRANCH') {
            return baseRefName === defaultBranchName;
          }
          const branchPattern = pattern.replace(/^refs\/heads\//, '');
          return (
            branchPattern === baseRefName || fnmatch(branchPattern, baseRefName)
          );
        });
      if (matchesExclude) continue;
      for (const rule of ruleset.rules.nodes) {
        if (rule.type !== 'REQUIRED_STATUS_CHECKS') continue;
        if ('requiredStatusChecks' in rule.parameters) {
          for (const check of rule.parameters.requiredStatusChecks) {
            requiredCheckNamesSet.add(check.context);
          }
        }
      }
    }

    const requiredCheckNames = Array.from(requiredCheckNamesSet);
    const seenContextNames = new Set<string>();
    for (const ctx of contexts) {
      if ('name' in ctx) {
        seenContextNames.add(ctx.name);
      }
      if ('context' in ctx) {
        seenContextNames.add(ctx.context);
      }
    }

    const missingRequiredCheckNames = requiredCheckNames.filter(
      (name) => !seenContextNames.has(name),
    );
    const allRequiredChecksPassed = missingRequiredCheckNames.length === 0;
    const isCiStateSuccess = ciState === 'SUCCESS';
    const isPassedAllCiJob = isCiStateSuccess && allRequiredChecksPassed;

    const reviewThreads = data.reviewThreads?.nodes || [];
    const isResolvedAllReviewComments =
      reviewThreads.length === 0 ||
      reviewThreads.every((thread) => thread.isResolved);

    return {
      url: prUrl,
      branchName: headRefName ?? null,
      createdAt: new Date(0),
      isDraft: data.isDraft === true,
      isConflicted,
      isPassedAllCiJob,
      isCiStateSuccess,
      isResolvedAllReviewComments,
      isBranchOutOfDate: false,
      missingRequiredCheckNames,
    };
  };

  findRelatedOpenPRs = async (
    issueUrl: string,
  ): Promise<RelatedPullRequest[]> => {
    const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(issueUrl);
    if (isPr) {
      throw new Error(
        'findRelatedOpenPRs only supports issue URLs, not pull request URLs',
      );
    }

    const query = `
      query($owner: String!, $repo: String!, $issueNumber: Int!, $after: String) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            timelineItems(first: 100, after: $after, itemTypes: [CROSS_REFERENCED_EVENT]) {
              pageInfo {
                endCursor
                hasNextPage
              }
              nodes {
                __typename
                ... on CrossReferencedEvent {
                  willCloseTarget
                  source {
                    __typename
                    ... on PullRequest {
                      url
                      number
                      state
                      createdAt
                      isDraft
                      mergeable
                      headRefName
                      baseRefName
                      baseRepository {
                        branchProtectionRules(first: 100) {
                          nodes {
                            pattern
                            requiredStatusCheckContexts
                          }
                        }
                        defaultBranchRef {
                          name
                        }
                        rulesets(first: 100) {
                          nodes {
                            name
                            enforcement
                            conditions {
                              refName {
                                include
                                exclude
                              }
                            }
                            rules(first: 100) {
                              nodes {
                                type
                                parameters {
                                  ... on RequiredStatusChecksParameters {
                                    requiredStatusChecks {
                                      context
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      commits(last: 1) {
                        nodes {
                          commit {
                            statusCheckRollup {
                              state
                              contexts(first: 100) {
                                nodes {
                                  __typename
                                  ... on CheckRun {
                                    name
                                    conclusion
                                  }
                                  ... on StatusContext {
                                    context
                                    state
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                      reviewThreads(first: 100) {
                        nodes {
                          isResolved
                        }
                      }
                      baseRef {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const relatedPRsMap: Map<string, RelatedPullRequest> = new Map();
    let after: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { owner, repo, issueNumber, after },
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch issue timeline from GitHub GraphQL API: HTTP ${response.status}`,
        );
      }

      const responseData: unknown = await response.json();
      if (!isIssueTimelineResponse(responseData)) {
        throw new Error(
          `Unexpected response shape when fetching issue timeline: ${issueUrl}`,
        );
      }

      const issueData = responseData.data?.repository?.issue;
      if (!issueData) {
        throw new Error(
          `Issue not found when fetching timeline from GitHub GraphQL API: ${issueUrl}`,
        );
      }

      for (const item of issueData.timelineItems.nodes) {
        if (item.__typename !== 'CrossReferencedEvent') continue;
        if (!item.source || item.source.__typename !== 'PullRequest') continue;
        if (item.source.state !== 'OPEN') continue;
        if (!item.willCloseTarget) continue;

        const pr = item.source;
        const prUrl = pr.url || '';
        const baseRefName = pr.baseRefName ?? pr.baseRef?.name;
        const prStatus = this.computePrStatus(
          prUrl,
          pr.headRefName,
          baseRefName,
          pr,
        );

        relatedPRsMap.set(prUrl, {
          ...prStatus,
          createdAt: pr.createdAt ? new Date(pr.createdAt) : new Date(0),
        });
      }

      hasNextPage = issueData.timelineItems.pageInfo.hasNextPage;
      after = issueData.timelineItems.pageInfo.endCursor;
    }

    return Array.from(relatedPRsMap.values());
  };

  getAllOpened = async (
    project: Project,
    allowCacheMinutes: number,
  ): Promise<Issue[]> => {
    const { issues } = await this.getAllIssues(project.id, allowCacheMinutes);
    return issues.filter((issue) => !issue.isClosed);
  };

  getStoryObjectMap = async (
    project: Project,
    allowCacheMinutes: number,
  ): Promise<StoryObjectMap> => {
    const { issues } = await this.getAllIssues(project.id, allowCacheMinutes);
    const storyObjectMap: StoryObjectMap = new Map();
    const targetStories = project.story?.stories || [];
    for (const story of targetStories) {
      const storyIssue = issues.find((issue) =>
        story.name.startsWith(issue.title),
      );
      storyObjectMap.set(story.name, {
        story,
        storyIssue: storyIssue || null,
        issues: [],
      });
      for (const issue of issues) {
        if (issue.story !== story.name) continue;
        storyObjectMap.get(story.name)?.issues.push(issue);
      }
    }
    return storyObjectMap;
  };

  getOpenPullRequest = async (
    prUrl: string,
  ): Promise<RelatedPullRequest | null> => {
    const parsedUrl = this.parseIssueUrl(prUrl);
    if (!parsedUrl.isPr) {
      return null;
    }
    const { owner, repo, issueNumber: prNumber } = parsedUrl;

    const query = `
      query($owner: String!, $repo: String!, $prNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            url
            state
            isDraft
            headRefName
            baseRefName
            mergeable
            baseRepository {
              branchProtectionRules(first: 100) {
                nodes {
                  pattern
                  requiredStatusCheckContexts
                }
              }
              defaultBranchRef {
                name
              }
              rulesets(first: 100) {
                nodes {
                  name
                  enforcement
                  conditions {
                    refName {
                      include
                      exclude
                    }
                  }
                  rules(first: 100) {
                    nodes {
                      type
                      parameters {
                        ... on RequiredStatusChecksParameters {
                          requiredStatusChecks {
                            context
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    state
                    contexts(first: 100) {
                      nodes {
                        __typename
                        ... on CheckRun {
                          name
                          conclusion
                        }
                        ... on StatusContext {
                          context
                          state
                        }
                      }
                    }
                  }
                }
              }
            }
            reviewThreads(first: 100) {
              nodes {
                isResolved
              }
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, prNumber },
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch pull request from GitHub GraphQL API: HTTP ${response.status}`,
      );
    }

    const responseData: unknown = await response.json();
    if (!isDirectPullRequestResponse(responseData)) {
      throw new Error('Unexpected response shape when fetching pull request');
    }

    if (responseData.errors && responseData.errors.length > 0) {
      throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
    }

    const pr = responseData.data?.repository?.pullRequest;
    if (!pr || pr.state !== 'OPEN') {
      return null;
    }

    return this.computePrStatus(pr.url, pr.headRefName, pr.baseRefName, pr);
  };

  closePullRequest = async (prUrl: string): Promise<void> => {
    const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed' }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to close PR ${prUrl}: HTTP ${response.status}`);
    }
  };

  closeIssueByUrl = async (
    issueUrl: string,
    stateReason: 'completed' | 'not_planned',
  ): Promise<void> => {
    const { owner, repo, issueNumber } = this.parseIssueUrl(issueUrl);
    const ownerSegment = encodeURIComponent(owner);
    const repoSegment = encodeURIComponent(repo);
    const response = await fetch(
      `https://api.github.com/repos/${ownerSegment}/${repoSegment}/issues/${issueNumber}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state: 'closed', state_reason: stateReason }),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to close issue ${issueUrl}: HTTP ${response.status}`,
      );
    }
  };

  getPullRequestChangedFilePaths = async (prUrl: string): Promise<string[]> => {
    const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
    const perPage = 100;
    const collectedPaths: string[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch changed files for PR ${prUrl}: HTTP ${response.status}`,
        );
      }
      const body: unknown = await response.json();
      if (!isPullRequestFilesResponse(body)) {
        throw new Error(
          `Unexpected response shape when fetching changed files for PR ${prUrl}`,
        );
      }
      for (const file of body) {
        collectedPaths.push(file.filename);
      }
      if (body.length < perPage) {
        hasMore = false;
      } else {
        page += 1;
      }
    }
    return collectedPaths;
  };

  approvePullRequest = async (prUrl: string): Promise<void> => {
    const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ event: 'APPROVE' }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to approve PR ${prUrl}: HTTP ${response.status}`);
    }
  };

  requestChangesWithInlineComment = async (
    prUrl: string,
    changedFilePath: string | null,
    commentBody: string,
  ): Promise<void> => {
    const { owner, repo, issueNumber: prNumber } = this.parseIssueUrl(prUrl);
    if (changedFilePath === null) {
      await this.createCommentByUrl(prUrl, commentBody);
      return;
    }
    const reviewBody: Record<string, unknown> = {
      event: 'REQUEST_CHANGES',
      comments: [
        {
          path: changedFilePath,
          position: 1,
          body: commentBody,
        },
      ],
    };
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify(reviewBody),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to request changes on PR ${prUrl}: HTTP ${response.status}`,
      );
    }
  };

  deletePullRequestBranch = async (
    prUrl: string,
    branchName: string,
  ): Promise<void> => {
    const { owner, repo } = this.parseIssueUrl(prUrl);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branchName)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
        },
      },
    );
    if (!response.ok && response.status !== 422) {
      throw new Error(
        `Failed to delete branch ${branchName} for PR ${prUrl}: HTTP ${response.status}`,
      );
    }
  };

  createCommentByUrl = async (
    issueOrPrUrl: string,
    commentBody: string,
  ): Promise<void> => {
    await this.restIssueRepository.createComment(issueOrPrUrl, commentBody);
  };

  getIssueOrPullRequestBody = async (url: string): Promise<string> => {
    const { owner, repo, issueNumber } = this.parseIssueUrl(url);
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch body for ${url}: HTTP ${response.status}`,
      );
    }
    const body: unknown = await response.json();
    if (!isIssueOrPullRequestBodyResponse(body)) {
      throw new Error(
        `Unexpected response shape when fetching body for ${url}`,
      );
    }
    return body.body ?? '';
  };

  getIssueOrPullRequestComments = async (
    url: string,
  ): Promise<IssueComment[]> => {
    const { owner, repo, issueNumber } = this.parseIssueUrl(url);
    const perPage = 100;
    const collectedComments: IssueComment[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}&page=${page}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch comments for ${url}: HTTP ${response.status}`,
        );
      }
      const body: unknown = await response.json();
      if (!isIssueCommentsResponse(body)) {
        throw new Error(
          `Unexpected response shape when fetching comments for ${url}`,
        );
      }
      for (const comment of body) {
        collectedComments.push({
          author: comment.user?.login ?? '',
          body: comment.body ?? '',
          createdAt: new Date(comment.created_at),
        });
      }
      if (body.length < perPage) {
        hasMore = false;
      } else {
        page += 1;
      }
    }
    return collectedComments;
  };

  getPullRequestDetail = async (
    prUrl: string,
  ): Promise<PullRequestDetail | null> => {
    const {
      owner,
      repo,
      issueNumber: prNumber,
      isPr,
    } = this.parseIssueUrl(prUrl);
    if (!isPr) {
      return null;
    }
    const detailResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!detailResponse.ok) {
      throw new Error(
        `Failed to fetch detail for PR ${prUrl}: HTTP ${detailResponse.status}`,
      );
    }
    const detailBody: unknown = await detailResponse.json();
    if (!isPullRequestDetailResponse(detailBody)) {
      throw new Error(
        `Unexpected response shape when fetching detail for PR ${prUrl}`,
      );
    }
    const files = await this.fetchPullRequestFiles(
      owner,
      repo,
      prNumber,
      prUrl,
    );
    return {
      title: detailBody.title,
      state: detailBody.state,
      merged: detailBody.merged,
      isDraft: detailBody.draft,
      additions: detailBody.additions,
      deletions: detailBody.deletions,
      changedFiles: detailBody.changed_files,
      headRefName: detailBody.head.ref,
      baseRefName: detailBody.base.ref,
      author: detailBody.user?.login ?? '',
      files,
    };
  };

  private fetchPullRequestFiles = async (
    owner: string,
    repo: string,
    prNumber: number,
    prUrl: string,
  ): Promise<PullRequestFile[]> => {
    const perPage = 100;
    const collectedFiles: PullRequestFile[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=${perPage}&page=${page}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch files for PR ${prUrl}: HTTP ${response.status}`,
        );
      }
      const body: unknown = await response.json();
      if (!isPullRequestDetailFilesResponse(body)) {
        throw new Error(
          `Unexpected response shape when fetching files for PR ${prUrl}`,
        );
      }
      for (const file of body) {
        collectedFiles.push({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch ?? null,
        });
      }
      if (body.length < perPage) {
        hasMore = false;
      } else {
        page += 1;
      }
    }
    return collectedFiles;
  };

  getPullRequestCommits = async (
    prUrl: string,
  ): Promise<PullRequestCommit[]> => {
    const {
      owner,
      repo,
      issueNumber: prNumber,
      isPr,
    } = this.parseIssueUrl(prUrl);
    if (!isPr) {
      return [];
    }
    const perPage = 100;
    const collectedCommits: PullRequestCommit[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/commits?per_page=${perPage}&page=${page}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch commits for PR ${prUrl}: HTTP ${response.status}`,
        );
      }
      const body: unknown = await response.json();
      if (!isPullRequestCommitsResponse(body)) {
        throw new Error(
          `Unexpected response shape when fetching commits for PR ${prUrl}`,
        );
      }
      for (const commit of body) {
        collectedCommits.push({
          sha: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author?.name ?? '',
          authoredAt: new Date(commit.commit.author?.date ?? 0),
        });
      }
      if (body.length < perPage) {
        hasMore = false;
      } else {
        page += 1;
      }
    }
    return collectedCommits;
  };

  getIssueOrPullRequestState = async (
    url: string,
  ): Promise<{ state: string; merged: boolean; isPullRequest: boolean }> => {
    const { owner, repo, issueNumber, isPr } = this.parseIssueUrl(url);
    if (isPr) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${issueNumber}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch state for ${url}: HTTP ${response.status}`,
        );
      }
      const body: unknown = await response.json();
      if (!isPullRequestDetailResponse(body)) {
        throw new Error(
          `Unexpected response shape when fetching state for ${url}`,
        );
      }
      return { state: body.state, merged: body.merged, isPullRequest: true };
    }
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch state for ${url}: HTTP ${response.status}`,
      );
    }
    const body: unknown = await response.json();
    if (!isIssueOrPullRequestStateResponse(body)) {
      throw new Error(
        `Unexpected response shape when fetching state for ${url}`,
      );
    }
    return { state: body.state, merged: false, isPullRequest: false };
  };

  getPullRequestSummary = async (
    prUrl: string,
  ): Promise<{
    title: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  } | null> => {
    const {
      owner,
      repo,
      issueNumber: prNumber,
      isPr,
    } = this.parseIssueUrl(prUrl);
    if (!isPr) {
      return null;
    }
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.ghToken}`,
          Accept: 'application/vnd.github+json',
        },
      },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch summary for PR ${prUrl}: HTTP ${response.status}`,
      );
    }
    const body: unknown = await response.json();
    if (!isPullRequestDetailResponse(body)) {
      throw new Error(
        `Unexpected response shape when fetching summary for PR ${prUrl}`,
      );
    }
    return {
      title: body.title,
      body: body.body ?? '',
      additions: body.additions,
      deletions: body.deletions,
      changedFiles: body.changed_files,
    };
  };
}
