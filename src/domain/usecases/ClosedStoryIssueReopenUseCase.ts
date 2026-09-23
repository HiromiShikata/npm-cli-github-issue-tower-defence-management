import { Issue } from '../entities/Issue';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class ClosedStoryIssueReopenUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'reopenIssueByUrl' | 'searchIssues' | 'getIssueByUrl'
    >,
  ) {}

  run = async (params: {
    issues: Issue[];
    storyObjectMap: StoryObjectMap;
    storyIssueOwnerRepo: string;
  }): Promise<number> => {
    let reopenedCount = 0;
    const errors: unknown[] = [];

    for (const storyObject of params.storyObjectMap.values()) {
      if (storyObject.storyIssue !== null) {
        continue;
      }
      if (storyObject.story.name.startsWith('regular / ')) {
        continue;
      }
      const closedStoryIssue =
        params.issues.find(
          (issue) =>
            storyObject.story.name.startsWith(issue.title) &&
            issue.isClosed &&
            issue.labels.includes('story'),
        ) ??
        (await this.findArchivedClosedStoryIssue(
          storyObject.story.name,
          params.storyIssueOwnerRepo,
        ));
      if (!closedStoryIssue) {
        continue;
      }
      try {
        await this.issueRepository.reopenIssueByUrl(closedStoryIssue.url);
        storyObject.storyIssue = {
          ...closedStoryIssue,
          isClosed: false,
          stateReason: 'REOPENED',
          state: 'OPEN',
        };
        reopenedCount++;
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed to reopen ${errors.length} story issue(s)`,
      );
    }
    return reopenedCount;
  };

  private findArchivedClosedStoryIssue = async (
    storyName: string,
    ownerRepo: string,
  ): Promise<Issue | null> => {
    const query = `repo:${ownerRepo} is:closed label:story "${storyName}" in:title`;
    const results = await this.issueRepository.searchIssues(query);
    if (results.length === 0) {
      return null;
    }
    const issue = await this.issueRepository.getIssueByUrl(results[0].url);
    if (!issue || !issue.isClosed || !issue.labels.includes('story')) {
      return null;
    }
    return issue;
  };
}
