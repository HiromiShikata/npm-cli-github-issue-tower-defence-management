import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { CheerioIssueRepository } from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';

export class ApiV3CheerioRestIssueRepository implements IssueRepository {
  constructor(
    readonly apiV3IssueRepository: ApiV3IssueRepository,
    readonly cheerioIssueRepository: CheerioIssueRepository,
    readonly restIssueRepository: RestIssueRepository,
    readonly graphqlProjectItemRepository: GraphqlProjectItemRepository,
  ) {}

  getAllIssues = async (projectId: Project['id']): Promise<Issue[]> => {
    const items =
      await this.graphqlProjectItemRepository.fetchProjectItems(projectId);
    const issues = await Promise.all(
      items.map(async (item): Promise<Issue> => {
        const timeline: WorkingTime[] =
          await this.cheerioIssueRepository.getInProgressTimeline(item.url);
        const restIssue = await this.restIssueRepository.getIssue(item.url);
        return {
          ...item,
          labels: restIssue.labels,
          assignees: restIssue.assignees,
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
