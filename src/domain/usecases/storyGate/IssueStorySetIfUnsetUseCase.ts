import {
  GithubIssueReference,
  StoryGateGithubRequestError,
  StoryGateIssueRepository,
} from '../adapter-interfaces/StoryGateIssueRepository';
import {
  DISABLED_STORY_OPTION_COLOR,
  isStoryUnset,
} from './storyValueClassify';

export type IssueStorySetIfUnsetOutcome =
  | 'WRITTEN'
  | 'SKIPPED_DRY_RUN'
  | 'LIVE_STORY_ALREADY_SET'
  | 'OPTION_NOT_ACTIVE'
  | 'ISSUE_NOT_IN_PROJECT'
  | 'READ_BACK_MISMATCH';

export type IssueStorySetIfUnsetInput = {
  issue: GithubIssueReference;
  storyName: string;
  dryRun: boolean;
};

export type IssueStorySetIfUnsetResult = {
  issueUrl: string;
  requestedStory: string;
  dryRun: boolean;
  outcome: IssueStorySetIfUnsetOutcome;
  liveStory: string | null;
  projectId: string | null;
  itemId: string | null;
};

export class IssueStorySetIfUnsetUseCase {
  constructor(private readonly issueRepository: StoryGateIssueRepository) {}

  run = async (
    input: IssueStorySetIfUnsetInput,
  ): Promise<IssueStorySetIfUnsetResult> => {
    const result: IssueStorySetIfUnsetResult = {
      issueUrl: input.issue.url,
      requestedStory: input.storyName,
      dryRun: input.dryRun,
      outcome: 'ISSUE_NOT_IN_PROJECT',
      liveStory: null,
      projectId: null,
      itemId: null,
    };
    const snapshot = await this.issueRepository.findIssueProjectItems(
      input.issue,
    );
    if (snapshot === null) {
      throw new StoryGateGithubRequestError(
        `Issue not found or not readable with the given token: ${input.issue.url}`,
      );
    }
    if (snapshot.items.length === 0) {
      return result;
    }
    const itemWithStory = snapshot.items.find(
      (item) => !isStoryUnset(item.storyName),
    );
    if (itemWithStory !== undefined) {
      return {
        ...result,
        outcome: 'LIVE_STORY_ALREADY_SET',
        liveStory: itemWithStory.storyName,
        projectId: itemWithStory.projectId,
        itemId: itemWithStory.itemId,
      };
    }
    const target = snapshot.items
      .map((item) => ({
        item,
        storyField: item.storyField,
        option: item.storyField?.options.find(
          (candidate) => candidate.name === input.storyName,
        ),
      }))
      .find((candidate) => candidate.option !== undefined);
    if (
      target === undefined ||
      target.option === undefined ||
      target.storyField === null ||
      target.option.color === DISABLED_STORY_OPTION_COLOR
    ) {
      return { ...result, outcome: 'OPTION_NOT_ACTIVE' };
    }
    const targetResult: IssueStorySetIfUnsetResult = {
      ...result,
      liveStory: target.item.storyName,
      projectId: target.item.projectId,
      itemId: target.item.itemId,
    };
    if (input.dryRun) {
      return { ...targetResult, outcome: 'SKIPPED_DRY_RUN' };
    }
    await this.issueRepository.updateProjectItemSingleSelectValue({
      projectId: target.item.projectId,
      itemId: target.item.itemId,
      fieldId: target.storyField.fieldId,
      optionId: target.option.id,
    });
    const readBack = await this.issueRepository.findIssueProjectItems(
      input.issue,
    );
    const readBackStory =
      readBack?.items.find((item) => item.itemId === target.item.itemId)
        ?.storyName ?? null;
    return {
      ...targetResult,
      liveStory: readBackStory,
      outcome:
        readBackStory === input.storyName ? 'WRITTEN' : 'READ_BACK_MISMATCH',
    };
  };
}
