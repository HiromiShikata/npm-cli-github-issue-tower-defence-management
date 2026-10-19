import { Issue } from '../entities/Issue';
import { IssueSummary } from '../entities/IssueSummary';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { IssueRepository } from './adapter-interfaces/IssueRepository';

export class ClosedStoryIssueReopenUseCase {
  constructor(
    private readonly issueRepository: Pick<
      IssueRepository,
      'reopenIssueByUrl' | 'getIssueByUrl' | 'getIssueSummariesByLabelAndState'
    >,
  ) {}

  run = async (params: {
    issues: Issue[];
    storyObjectMap: StoryObjectMap;
    storyIssueOwnerRepo: string;
  }): Promise<number> => {
    let reopenedCount = 0;
    const errors: unknown[] = [];
    const [owner, repositoryName] = params.storyIssueOwnerRepo.split('/');
    const loadOpenStoryIssueSummaries = this.createStoryIssueSummariesLoader({
      owner,
      repositoryName,
      state: 'open',
    });
    const loadClosedStoryIssueSummaries = this.createStoryIssueSummariesLoader({
      owner,
      repositoryName,
      state: 'closed',
    });

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
          loadOpenStoryIssueSummaries,
          loadClosedStoryIssueSummaries,
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

  private readonly createStoryIssueSummariesLoader = (params: {
    owner: string;
    repositoryName: string;
    state: 'open' | 'closed';
  }): (() => Promise<IssueSummary[]>) => {
    let storyIssueSummaries: Promise<IssueSummary[]> | null = null;
    return () => {
      if (storyIssueSummaries === null) {
        storyIssueSummaries =
          this.issueRepository.getIssueSummariesByLabelAndState({
            ...params,
            label: 'story',
          });
      }
      return storyIssueSummaries;
    };
  };

  private readonly findArchivedClosedStoryIssue = async (
    storyName: string,
    loadOpenStoryIssueSummaries: () => Promise<IssueSummary[]>,
    loadClosedStoryIssueSummaries: () => Promise<IssueSummary[]>,
  ): Promise<Issue | null> => {
    const openStoryIssueSummaries = await loadOpenStoryIssueSummaries();
    if (
      openStoryIssueSummaries.some(
        (storyIssueSummary) => storyIssueSummary.title === storyName,
      )
    ) {
      return null;
    }
    const closedStoryIssueSummary = (
      await loadClosedStoryIssueSummaries()
    ).find((storyIssueSummary) => storyIssueSummary.title === storyName);
    if (!closedStoryIssueSummary) {
      return null;
    }
    const issue = await this.issueRepository.getIssueByUrl(
      closedStoryIssueSummary.url,
    );
    if (!issue || !issue.isClosed || !issue.labels.includes('story')) {
      return null;
    }
    return issue;
  };
}
