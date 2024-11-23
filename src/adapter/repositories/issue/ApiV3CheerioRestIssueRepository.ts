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
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import typia from 'typia';
import { BaseGitHubRepository } from '../BaseGitHubRepository';
import { normalizeFieldName } from '../utils';

export class ApiV3CheerioRestIssueRepository
  extends BaseGitHubRepository
  implements IssueRepository
{
  constructor(
    readonly apiV3IssueRepository: Pick<ApiV3IssueRepository, 'searchIssue'>,
    readonly cheerioIssueRepository: Pick<CheerioIssueRepository, 'getIssue'>,
    readonly restIssueRepository: Pick<
      RestIssueRepository,
      'createNewIssue' | 'updateIssue'
    >,
    readonly graphqlProjectItemRepository: Pick<
      GraphqlProjectItemRepository,
      | 'fetchProjectItems'
      | 'fetchProjectItemByUrl'
      | 'updateProjectField'
      | 'clearProjectField'
    >,
    readonly localStorageCacheRepository: Pick<
      LocalStorageCacheRepository,
      'getLatest' | 'set'
    >,
  ) {
    super();
  }

  convertProjectItemAndCheerioIssueToIssue = async (
    item: ProjectItem,
    cheerioIssue: CheerioIssue,
  ): Promise<Issue> => {
    const timeline: WorkingTime[] = cheerioIssue.inProgressTimeline;
    const nextActionDate = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactiondate',
    )?.value;
    const nextActionHour = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'nextactionhour',
    )?.value;
    const estimationMinutes = item.customFields.find(
      (field) => normalizeFieldName(field.name) === 'estimationminutes',
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
      labels: cheerioIssue.labels,
      assignees: cheerioIssue.assignees,
      workingTimeline: timeline,
      nextActionDate: nextActionDate ? new Date(nextActionDate) : null,
      nextActionHour: nextActionHour ? parseInt(nextActionHour) : null,
      estimationMinutes: estimationMinutes ? parseInt(estimationMinutes) : null,
      status: status || null,
      story: story || null,
      org: owner,
      repo: repo,
      body: item.body,
      itemId: item.id,
      isPr: item.url.includes('/pull/'),
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
            const workingTimeline =
              !('workingTimeline' in issue) ||
              !Array.isArray(issue.workingTimeline)
                ? []
                : issue.workingTimeline.map((event: object): object => {
                    const startedAt =
                      !('startedAt' in event) ||
                      typeof event.startedAt !== 'string' ||
                      event.startedAt === null
                        ? null
                        : new Date(event.startedAt);
                    const endedAt =
                      !('endedAt' in event) ||
                      typeof event.endedAt !== 'string' ||
                      event.endedAt === null
                        ? null
                        : new Date(event.endedAt);
                    return {
                      ...event,
                      startedAt,
                      endedAt,
                    };
                  });

            return {
              ...issue,
              nextActionDate: nextActionDate,
              workingTimeline: workingTimeline,
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

    const issues = await Promise.all(
      items.map(async (item): Promise<Issue> => {
        const cheerioIssue = await this.cheerioIssueRepository.getIssue(
          item.url,
        );
        return this.convertProjectItemAndCheerioIssueToIssue(
          item,
          cheerioIssue,
        );
      }),
    );
    return issues;
  };
  createNewIssue = async (
    org: string,
    repo: string,
    title: string,
    body: string,
    assignees: string[],
    labels: string[],
  ): Promise<void> => {
    await this.restIssueRepository.createNewIssue(
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
    const cheerioIssue = await this.cheerioIssueRepository.getIssue(url);
    return this.convertProjectItemAndCheerioIssueToIssue(
      projectItem,
      cheerioIssue,
    );
  };
  updateNextActionDate = async (
    project: Project & { nextActionDate: Required<Project['nextActionDate']> },
    issue: Issue,
    date: Date,
  ): Promise<void> => {
    if (project.nextActionDate === null) {
      throw new Error('nextActionDate is not defined');
    }
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.nextActionDate.fieldId,
      issue.itemId,
      { date: date.toISOString() },
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
    story: string,
  ): Promise<void> => {
    return this.graphqlProjectItemRepository.updateProjectField(
      project.id,
      project.story.fieldId,
      issue.itemId,
      { text: story },
    );
  };
  clearProjectField = async (
    project: Project,
    fieldId: string,
    issue: Issue,
  ): Promise<void> => {
    return this.graphqlProjectItemRepository.clearProjectField(
      project.id,
      fieldId,
      issue.itemId,
    );
  };
}
