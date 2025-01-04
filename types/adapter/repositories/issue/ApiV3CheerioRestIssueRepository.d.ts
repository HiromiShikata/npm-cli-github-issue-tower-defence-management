import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import {
  CheerioIssueRepository,
  Issue as CheerioIssue,
} from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import {
  GraphqlProjectItemRepository,
  ProjectItem,
} from './GraphqlProjectItemRepository';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
export declare class ApiV3CheerioRestIssueRepository
  extends BaseGitHubRepository
  implements IssueRepository
{
  readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>;
  readonly cheerioIssueRepository: Pick<
    CheerioIssueRepository,
    'getIssue' | 'refreshCookie'
  >;
  readonly restIssueRepository: Pick<
    RestIssueRepository,
    'createNewIssue' | 'updateIssue' | 'createComment'
  >;
  readonly graphqlProjectItemRepository: Pick<
    GraphqlProjectItemRepository,
    | 'fetchProjectItems'
    | 'fetchProjectItemByUrl'
    | 'updateProjectField'
    | 'clearProjectField'
    | 'updateProjectTextField'
  >;
  readonly localStorageCacheRepository: Pick<
    LocalStorageCacheRepository,
    'getLatest' | 'set'
  >;
  readonly localStorageRepository: LocalStorageRepository;
  readonly jsonFilePath: string;
  readonly ghToken: string;
  readonly ghUserName: string | undefined;
  readonly ghUserPassword: string | undefined;
  readonly ghAuthenticatorKey: string | undefined;
  constructor(
    apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>,
    cheerioIssueRepository: Pick<
      CheerioIssueRepository,
      'getIssue' | 'refreshCookie'
    >,
    restIssueRepository: Pick<
      RestIssueRepository,
      'createNewIssue' | 'updateIssue' | 'createComment'
    >,
    graphqlProjectItemRepository: Pick<
      GraphqlProjectItemRepository,
      | 'fetchProjectItems'
      | 'fetchProjectItemByUrl'
      | 'updateProjectField'
      | 'clearProjectField'
      | 'updateProjectTextField'
    >,
    localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
    localStorageRepository: LocalStorageRepository,
    jsonFilePath?: string,
    ghToken?: string,
    ghUserName?: string | undefined,
    ghUserPassword?: string | undefined,
    ghAuthenticatorKey?: string | undefined,
  );
  convertProjectItemAndCheerioIssueToIssue: (
    item: ProjectItem,
    cheerioIssue: CheerioIssue,
  ) => Promise<Issue>;
  getAllIssuesFromCache: (
    cacheKey: string,
    allowCacheMinutes: number,
  ) => Promise<Issue[] | null>;
  getAllIssues: (
    projectId: Project['id'],
    allowCacheMinutes: number,
  ) => Promise<{
    issues: Issue[];
    cacheUsed: boolean;
  }>;
  getAllIssuesFromGitHub: (projectId: Project['id']) => Promise<Issue[]>;
  createNewIssue: (
    org: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ) => Promise<number>;
  updateIssue: (issue: Issue) => Promise<void>;
  getIssueByUrl: (url: string) => Promise<Issue | null>;
  updateNextActionDate: (
    project: Project & {
      nextActionDate: Required<Project['nextActionDate']>;
    },
    issue: Issue,
    date: Date,
  ) => Promise<void>;
  updateNextActionHour: (
    project: Project & {
      nextActionHour: NonNullable<Project['nextActionHour']>;
    },
    issue: Issue,
    hour: number,
  ) => Promise<void>;
  updateStory: (
    project: Project & {
      story: NonNullable<Project['story']>;
    },
    issue: Issue,
    storyOptionId: string,
  ) => Promise<void>;
  clearProjectField: (
    project: Project,
    fieldId: string,
    issue: Issue,
  ) => Promise<void>;
  createComment: (issue: Issue, comment: string) => Promise<void>;
  updateProjectTextField: (
    project: Project,
    fieldId: string,
    issue: Issue,
    text: string,
  ) => Promise<void>;
}
//# sourceMappingURL=ApiV3CheerioRestIssueRepository.d.ts.map
