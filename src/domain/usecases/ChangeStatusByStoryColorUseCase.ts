import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from './HandleScheduledEventUseCase';

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
    disabledStatus: string;
    storyObjectMap: StoryObjectMap;
  }): Promise<void> => {
    const firstStatus = input.project.status.statuses[0];
    if (!firstStatus) {
      throw new Error('First status is not found');
    } else if (input.cacheUsed) {
      return;
    }
    const disabledStatusObject = input.project.status.statuses.find(
      (status) => status.name === input.disabledStatus,
    );
    if (!disabledStatusObject) {
      throw new Error('Disabled status is not found');
    }
    for (const storyObject of Array.from(input.storyObjectMap.values())) {
      const isStoryDisabled = storyObject.story.color === 'GRAY';
      for (const issue of storyObject.issues) {
        if (isStoryDisabled) {
          if (issue.status && issue.status === input.disabledStatus) {
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
          if (issue.status && issue.status !== input.disabledStatus) {
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
