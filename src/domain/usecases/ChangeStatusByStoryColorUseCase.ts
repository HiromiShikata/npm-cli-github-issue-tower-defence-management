import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Project } from '../entities/Project';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { ICEBOX_STATUS_NAME } from '../entities/WorkflowStatus';
import { Member } from '../entities/Member';
import { Issue } from '../entities/Issue';
import {
  commentCreateWithDedupRetry,
  realSleep,
  Sleep,
} from '../services/commentCreateWithDedupRetry';
import { issueSnapshotStalenessCheck } from './issueSnapshotStalenessCheck';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

export class ChangeStatusByStoryColorUseCase {
  constructor(
    readonly dateRepository: Pick<DateRepository, 'now'>,
    readonly issueRepository: Pick<
      IssueRepository,
      | 'updateStatus'
      | 'createComment'
      | 'getIssueOrPullRequestComments'
      | 'get'
      | 'removeIssueFromProjectCache'
    >,
    private readonly sleep: Sleep = realSleep,
  ) {}

  run = async (input: {
    project: Project;
    org: string;
    repo: string;
    storyObjectMap: StoryObjectMap;
    manager: Member['name'];
  }): Promise<void> => {
    const firstStatus = input.project.status.statuses[0];
    if (!firstStatus) {
      throw new Error('First status is not found');
    }
    const disabledStatusObject = input.project.status.statuses.find(
      (status) => status.name === ICEBOX_STATUS_NAME,
    );
    if (!disabledStatusObject) {
      throw new Error('Icebox status is not found');
    }
    const failedIssueDescriptions: string[] = [];
    for (const storyObject of Array.from(input.storyObjectMap.values())) {
      const isStoryDisabled = storyObject.story.color === 'GRAY';
      for (const issue of storyObject.issues) {
        if (isStoryDisabled) {
          if (issue.status && issue.status === ICEBOX_STATUS_NAME) {
            continue;
          }
          const liveIssue = await this.isSnapshotStoryAndStatusStillCurrent(
            input.project,
            issue,
            disabledStatusObject.name,
          );
          if (liveIssue === null) {
            continue;
          }
          try {
            await this.issueRepository.updateStatus(
              input.project,
              liveIssue,
              disabledStatusObject.id,
            );
          } catch (error) {
            if (error instanceof StaleProjectItemError) {
              console.warn(
                `Skipping stale project item while disabling status: ${issue.url} (itemId=${error.itemId})`,
              );
              continue;
            }
            failedIssueDescriptions.push(
              `${issue.url}: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }
          await this.createCommentWithDedup(
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
          const liveIssue = await this.isSnapshotStoryAndStatusStillCurrent(
            input.project,
            issue,
            firstStatus.name,
          );
          if (liveIssue === null) {
            continue;
          }
          try {
            await this.issueRepository.updateStatus(
              input.project,
              liveIssue,
              firstStatus.id,
            );
          } catch (error) {
            if (error instanceof StaleProjectItemError) {
              console.warn(
                `Skipping stale project item while enabling status: ${issue.url} (itemId=${error.itemId})`,
              );
              continue;
            }
            failedIssueDescriptions.push(
              `${issue.url}: ${error instanceof Error ? error.message : String(error)}`,
            );
            continue;
          }
          await this.createCommentWithDedup(
            issue,
            `This issue status is changed because the story is enabled.`,
          );
        }
      }
    }
    if (failedIssueDescriptions.length > 0) {
      throw new Error(
        `Failed to change status by story color for ${failedIssueDescriptions.length} issue(s): ${failedIssueDescriptions.join('; ')}`,
      );
    }
  };

  private isSnapshotStoryAndStatusStillCurrent = async (
    project: Project,
    issue: Issue,
    plannedStatusName: string,
  ): Promise<Issue | null> => {
    const staleness = await issueSnapshotStalenessCheck({
      issueRepository: this.issueRepository,
      project,
      snapshotIssue: issue,
      checkedFieldNames: ['story', 'status'],
      skippedWriteDescription: `the ${plannedStatusName} Status write`,
    });
    return staleness.type === 'current' ? staleness.liveIssue : null;
  };

  private createCommentWithDedup = async (
    issue: Issue,
    commentBody: string,
  ): Promise<void> => {
    await commentCreateWithDedupRetry(
      commentBody,
      async () => {
        const existing =
          await this.issueRepository.getIssueOrPullRequestComments(issue.url);
        return existing.map((c) => ({
          text: c.body,
          createdAt: c.createdAt,
        }));
      },
      async () => {
        await this.issueRepository.createComment(issue, commentBody);
      },
      () => new Date(),
      this.sleep,
    );
  };
}
