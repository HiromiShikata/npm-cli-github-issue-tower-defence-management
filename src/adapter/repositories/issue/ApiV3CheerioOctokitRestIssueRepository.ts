import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { ApiV3IssueRepository } from './ApiV3IssueRepository';
import { CheerioIssueRepository } from './CheerioIssueRepository';
import { RestIssueRepository } from './RestIssueRepository';
import { GraphqlProjectItemRepository } from './GraphqlProjectItemRepository';
import { WorkingTime } from '../../../domain/entities/WorkingTime';
import { OctokitIssueRepository } from './OctokitIssueRepository';

export class ApiV3CheerioOctokitRestIssueRepository implements IssueRepository {
  constructor(
    readonly apiV3IssueRepository: ApiV3IssueRepository,
    readonly cheerioIssueRepository: CheerioIssueRepository,
    readonly octokitIssueRepository: OctokitIssueRepository,
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
        const octokitIssue = await this.octokitIssueRepository.getIssue(
          item.url,
        );
        return {
          ...item,
          labels: octokitIssue.labels
            .map((label) => (typeof label === 'string' ? label : label.name))
            .filter((label): label is string => !!label),
          assignees: !octokitIssue.assignees
            ? []
            : octokitIssue.assignees.map((assignee) => assignee.login),
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
