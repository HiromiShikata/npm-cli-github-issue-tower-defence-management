import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import { Member } from '../entities/Member';

export class ChangeStatusByStoryColorUseCase {
  constructor(
    readonly dateRepository: Pick<DateRepository, 'now'>,
    readonly issueRepository: Pick<
      IssueRepository,
      'updateStatus' | 'createComment'
    >,
  ) {}

  run = async (input: {
    project: Project;
    cacheUsed: boolean;
    org: string;
    repo: string;
    storyObjectMap: StoryObjectMap;
    manager: Member['name'];
  }): Promise<void> => {
    const firstStatus = input.project.status.statuses[0];
    if (!firstStatus) {
      throw new Error('First status is not found');
    } else if (input.cacheUsed) {
      return;
    }
    const disabledStatusObject = input.project.status.statuses.find(
      (status) => status.name === ICEBOX_STATUS_NAME,
    );
    if (!disabledStatusObject) {
      throw new Error('Icebox status is not found');
    }
    for (const storyObject of Array.from(input.storyObjectMap.values())) {
      const isStoryDisabled = storyObject.story.color === 'GRAY';
      for (const issue of storyObject.issues) {
        if (isStoryDisabled) {
          if (issue.status && issue.status === ICEBOX_STATUS_NAME) {
            continue;
          }
          await this.issueRepository.updateStatus(
            input.project,
            issue,
            disabledStatusObject.id,
          );
          await this.issueRepository.createComment(
            issue,
            `This issue status is changed because the story is disabled.`,
          );
        } else if (!isStoryDisabled) {
          if (issue.status && issue.status !== ICEBOX_STATUS_NAME) {
            continue;
          }
          const hasNoStatus = !issue.status;
          const isOwnedByNonManagerAssignee = issue.assignees.some(
            (assignee) => assignee !== input.manager,
          );
          if (hasNoStatus && isOwnedByNonManagerAssignee) {
            console.warn(
              `ChangeStatusByStoryColorUseCase: skipping the first status write because the issue has no status and is assigned to someone other than the manager. issueUrl: ${issue.url} assignees: ${issue.assignees.join(', ')}`,
            );
            continue;
          }
          await this.issueRepository.updateStatus(
            input.project,
            issue,
            firstStatus.id,
          );
          await this.issueRepository.createComment(
            issue,
            `This issue status is changed because the story is enabled.`,
          );
        }
      }
    }
  };
}
