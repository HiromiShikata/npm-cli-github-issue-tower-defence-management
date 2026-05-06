import {
  IssueRepository,
  RelatedPullRequest,
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

type GetPullRequestResponse = {
  data?: {
    repository?: {
      pullRequest?: {
        state: string;
        mergeable: string;
        commits: {
          nodes: {
            commit: {
              statusCheckRollup: {
                state: string;
                contexts: {
                  nodes: (
                    | {
                        name?: string;
                        status?: string;
                        conclusion?: string | null;
                      }
                    | {
                        context?: string;
                        state?: string;
                      }
                  )[];
                };
              } | null;
            };
          }[];
        };
        reviewThreads: {
          nodes: { isResolved: boolean }[];
        };
        baseRepository: {
          branchProtectionRules: {
            nodes: { requiredStatusCheckContexts: string[] }[];
          };
          rulesets: {
            nodes: {
              rules: {
                nodes: {
                  type: string;
                  parameters?: {
                    requiredStatusChecks?: { context: string }[];
                  };
                }[];
              };
            }[];
          };
        };
      };
    };
  };
  errors?: { message: string }[];
};

type FindRelatedPRsResponse = {
  data?: {
    repository?: {
      issue?: {
        timelineItems: {
          nodes: {
            source?: {
              url?: string;
              state?: string;
            };
          }[];
        };
      };
    };
  };
  errors?: { message: string }[];
};

function isGetPullRequestResponse(
  value: unknown,
): value is GetPullRequestResponse {
  return typia.is<GetPullRequestResponse>(value);
}

function isFindRelatedPRsResponse(
  value: unknown,
): value is FindRelatedPRsResponse {
  return typia.is<FindRelatedPRsResponse>(value);
}

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
    >,
    readonly localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
    readonly localStorageRepository: LocalStorageRepository,
    readonly jsonFilePath: string = './tmp/github.com.cookies.json',
    readonly ghToken: string = process.env.GH_TOKEN || 'dummy',
    readonly ghUserName: string | undefined = process.env.GH_USER_NAME,
    readonly ghUserPassword: string | undefined = process.env.GH_USER_PASSWORD,
    readonly ghAuthenticatorKey: string | undefined = process.env
      .GH_AUTHENTICATOR_KEY,
  ) {
    super(
      localStorageRepository,
      jsonFilePath,
      ghToken,
      ghUserName,
      ghUserPassword,
      ghAuthenticatorKey,
    );
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
      body: item.body,
      itemId: item.id,
      isPr: item.url.includes('/pull/'),
      isInProgress: normalizeFieldName(status || '').includes('progress'),
      isClosed: item.state !== 'OPEN',
      createdAt: new Date(item.createdAt || '2000-01-01'),
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
  updateNextActionDate = async (
    issueUrl: string,
    project: Project,
    date: Date,
  ): Promise<void> => {
    if (!project.nextActionDate) {
      return;
    }
    const projectItem =
      await this.graphqlProjectItemRepository.fetchProjectItemByUrl(issueUrl);
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

  getOpenPullRequest = async (
    prUrl: string,
  ): Promise<RelatedPullRequest | null> => {
    const match = prUrl.match(
      /https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/,
    );
    if (!match) {
      return null;
    }
    const [, owner, repo, prNumberStr] = match;
    const prNumber = parseInt(prNumberStr, 10);

    const query = `query GetPullRequest($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          state
          mergeable
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                  contexts(first: 100) {
                    nodes {
                      ... on CheckRun {
                        name
                        status
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
          baseRepository {
            branchProtectionRules(first: 10) {
              nodes {
                requiredStatusCheckContexts
              }
            }
            rulesets(first: 10) {
              nodes {
                rules(first: 50) {
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
        }
      }
    }`;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, number: prNumber },
      }),
    });

    const responseData: unknown = await response.json();
    if (!isGetPullRequestResponse(responseData)) {
      throw new Error(
        'Unexpected response shape when fetching pull request from GitHub GraphQL API',
      );
    }

    if (responseData.errors && responseData.errors.length > 0) {
      throw new Error(responseData.errors.map((e) => e.message).join('\n'));
    }

    const pr = responseData.data?.repository?.pullRequest;
    if (!pr || pr.state !== 'OPEN') {
      return null;
    }

    const isConflicted = pr.mergeable === 'CONFLICTING';

    const lastCommit = pr.commits.nodes[pr.commits.nodes.length - 1];
    const rollup = lastCommit?.commit?.statusCheckRollup;
    const isCiStateSuccess = rollup?.state === 'SUCCESS';

    const requiredCheckNames: string[] = [];
    for (const rule of pr.baseRepository.branchProtectionRules.nodes) {
      requiredCheckNames.push(...rule.requiredStatusCheckContexts);
    }
    for (const ruleset of pr.baseRepository.rulesets.nodes) {
      for (const rule of ruleset.rules.nodes) {
        if (
          rule.type === 'REQUIRED_STATUS_CHECKS' &&
          rule.parameters?.requiredStatusChecks
        ) {
          requiredCheckNames.push(
            ...rule.parameters.requiredStatusChecks.map((c) => c.context),
          );
        }
      }
    }

    const contextNodes = rollup?.contexts?.nodes ?? [];
    const completedCheckNames = contextNodes
      .map((node) => {
        if ('name' in node && node.name) {
          return node.name;
        }
        if ('context' in node && node.context) {
          return node.context;
        }
        return null;
      })
      .filter((name): name is string => name !== null);

    const missingRequiredCheckNames = requiredCheckNames.filter(
      (required) => !completedCheckNames.includes(required),
    );

    const isPassedAllCiJob =
      isCiStateSuccess && missingRequiredCheckNames.length === 0;

    const isResolvedAllReviewComments = pr.reviewThreads.nodes.every(
      (thread) => thread.isResolved,
    );

    return {
      url: prUrl,
      isConflicted,
      isPassedAllCiJob,
      isCiStateSuccess,
      isResolvedAllReviewComments,
      isBranchOutOfDate: false,
      missingRequiredCheckNames,
    };
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
  findRelatedOpenPRs = async (
    issueUrl: string,
  ): Promise<RelatedPullRequest[]> => {
    const match = issueUrl.match(
      /https:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/,
    );
    if (!match) {
      return [];
    }
    const [, owner, repo, issueNumberStr] = match;
    const issueNumber = parseInt(issueNumberStr, 10);

    const query = `query FindRelatedPRs($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], first: 50) {
            nodes {
              ... on CrossReferencedEvent {
                source {
                  ... on PullRequest {
                    url
                    state
                  }
                }
              }
            }
          }
        }
      }
    }`;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.ghToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo, number: issueNumber },
      }),
    });

    const responseData: unknown = await response.json();
    if (!isFindRelatedPRsResponse(responseData)) {
      throw new Error(
        'Unexpected response shape when fetching related PRs from GitHub GraphQL API',
      );
    }

    if (responseData.errors && responseData.errors.length > 0) {
      throw new Error(responseData.errors.map((e) => e.message).join('\n'));
    }

    const nodes =
      responseData.data?.repository?.issue?.timelineItems?.nodes ?? [];
    const openPrUrls = nodes
      .filter(
        (node) =>
          node.source?.url &&
          node.source?.state === 'OPEN' &&
          node.source.url.includes('/pull/'),
      )
      .map((node) => node.source?.url)
      .filter((url): url is string => url !== undefined);

    const results: RelatedPullRequest[] = [];
    for (const prUrl of openPrUrls) {
      const pr = await this.getOpenPullRequest(prUrl);
      if (pr) {
        results.push(pr);
      }
    }
    return results;
  };
  getAllOpened = async (_project: Project): Promise<Issue[]> => {
    throw new Error('getAllOpened is not implemented');
  };
  getStoryObjectMap = async (_project: Project): Promise<StoryObjectMap> => {
    throw new Error('getStoryObjectMap is not implemented');
  };
}
