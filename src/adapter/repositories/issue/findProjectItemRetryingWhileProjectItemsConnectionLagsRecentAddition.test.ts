import { mock } from 'jest-mock-extended';
import {
  findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition,
  projectItemsConnectionReadRetryAttemptsAfterRecentAddition,
} from './findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition';
import type {
  GraphqlProjectItemRepository,
  ProjectItem,
} from './GraphqlProjectItemRepository';

const interAttemptDelayMs = 1000;

const buildProjectItem = (id: string): ProjectItem => ({
  id,
  nameWithOwner: 'owner/repo',
  number: 1,
  title: 'test issue',
  state: 'OPEN',
  url: 'https://github.com/owner/repo/issues/1',
  body: null,
  labels: [],
  assignees: [],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  author: 'test-author',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  isRepoArchived: false,
  stateReason: null,
  customFields: [],
});

describe('findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses its full configured retry budget before giving up, which must now be large enough to tolerate the eventual-consistency lag that caused the live failures', async () => {
    expect(
      projectItemsConnectionReadRetryAttemptsAfterRecentAddition,
    ).toBeGreaterThanOrEqual(25);

    jest.useFakeTimers();
    const targetProjectId = 'test-project-id';
    const recentlyAddedItemId = 'recently-added-item-id';
    const targetItem = buildProjectItem(recentlyAddedItemId);
    const connectionWithoutTargetItem = {
      issues: [buildProjectItem('other-item-id')],
      inconsistencyMessage: null,
    };
    const connectionWithTargetItem = {
      issues: [buildProjectItem('other-item-id'), targetItem],
      inconsistencyMessage: null,
    };
    const mockedRepository = mock<GraphqlProjectItemRepository>();
    let callCount = 0;
    mockedRepository.fetchProjectItems.mockImplementation(async () => {
      const callIndex = callCount;
      callCount += 1;
      return callIndex ===
        projectItemsConnectionReadRetryAttemptsAfterRecentAddition - 1
        ? connectionWithTargetItem
        : connectionWithoutTargetItem;
    });

    const resultPromise =
      findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition(
        mockedRepository,
        targetProjectId,
        recentlyAddedItemId,
      );
    for (
      let attempt = 0;
      attempt < projectItemsConnectionReadRetryAttemptsAfterRecentAddition - 1;
      attempt++
    ) {
      await jest.advanceTimersByTimeAsync(interAttemptDelayMs);
    }
    const result = await resultPromise;

    expect(result).toEqual(targetItem);
    expect(mockedRepository.fetchProjectItems).toHaveBeenCalledTimes(
      projectItemsConnectionReadRetryAttemptsAfterRecentAddition,
    );
  });

  it('returns undefined without hanging once the entire retry budget is exhausted and the item never appears', async () => {
    jest.useFakeTimers();
    const targetProjectId = 'test-project-id';
    const recentlyAddedItemId = 'recently-added-item-id';
    const connectionWithoutTargetItem = {
      issues: [buildProjectItem('other-item-id')],
      inconsistencyMessage: null,
    };
    const mockedRepository = mock<GraphqlProjectItemRepository>();
    mockedRepository.fetchProjectItems.mockResolvedValue(
      connectionWithoutTargetItem,
    );

    const resultPromise =
      findProjectItemRetryingWhileProjectItemsConnectionLagsRecentAddition(
        mockedRepository,
        targetProjectId,
        recentlyAddedItemId,
      );
    for (
      let attempt = 0;
      attempt < projectItemsConnectionReadRetryAttemptsAfterRecentAddition;
      attempt++
    ) {
      await jest.advanceTimersByTimeAsync(interAttemptDelayMs);
    }
    const result = await resultPromise;

    expect(result).toBeUndefined();
    expect(mockedRepository.fetchProjectItems).toHaveBeenCalledTimes(
      projectItemsConnectionReadRetryAttemptsAfterRecentAddition,
    );
  });
});
