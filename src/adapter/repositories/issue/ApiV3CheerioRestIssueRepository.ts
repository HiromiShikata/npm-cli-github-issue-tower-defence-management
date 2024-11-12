import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { CheerioIssueRepository } from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { LocalStorageCacheRepository } from '../LocalStorageCacheRepository';
import typia from 'typia';

export class ApiV3CheerioRestIssueRepository implements IssueRepository {
  constructor(
    readonly apiV3IssueRepository: ApiV3IssueRepository,
    readonly cheerioIssueRepository: CheerioIssueRepository,
    readonly restIssueRepository: RestIssueRepository,
    readonly graphqlProjectItemRepository: GraphqlProjectItemRepository,
    readonly localStorageCacheRepository: LocalStorageCacheRepository,
  ) {}

  getAllIssues = async (
    projectId: Project['id'],
    allowCacheMinutes: number,
  ): Promise<Issue[]> => {
    const cacheKey = `allIssues-${projectId}`;
    const cache = await this.localStorageCacheRepository.getLatest(cacheKey);
    if (cache) {
      const now = new Date();
      const cacheTimestamp = cache.timestamp;
      const diff = now.getTime() - cacheTimestamp.getTime();
      if (diff < allowCacheMinutes * 60 * 1000) {
        if (typia.is<Issue[]>(cache.value)) {
          return cache.value;
        }
      }
    }
    const issues = await this.getAllIssuesFromGitHub(projectId);
    await this.localStorageCacheRepository.set(cacheKey, issues);
    return issues;
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
        const timeline: WorkingTime[] = cheerioIssue.inProgressTimeline;
        return {
          ...item,
          labels: cheerioIssue.labels,
          assignees: cheerioIssue.assignees,
          workingTimeline: timeline,
        };
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
}
