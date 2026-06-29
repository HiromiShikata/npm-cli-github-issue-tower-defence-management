import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { ResourceCache } from '../lib/resourceCache';
import type {
  ConsoleChangedFile,
  ConsoleRelatedPullRequest,
} from '../logic/types';
import {
  consoleChangedFilesFixture,
  consoleListItemsFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
  consoleStoryOptionsFixture,
} from '../testing/fixtures';
import { ConsoleItemDetailContainer } from './ConsoleItemDetailContainer';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

type CachesOverrides = {
  relatedPrs?: ConsoleRelatedPullRequest[];
  prFiles?: ConsoleChangedFile[];
};

const buildCaches = (overrides: CachesOverrides = {}): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => '# body',
    fetchComments: async () => [],
    fetchPrFiles: async () => overrides.prFiles ?? [],
    fetchPrCommits: async () => [],
    fetchRelatedPrs: async () => overrides.relatedPrs ?? [],
    fetchIssueState: async () => ({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Container fixture title',
    }),
    fetchPullRequestStatus: async () => ({
      found: true,
      isConflicted: false,
      mergeableStatus: 'MERGEABLE' as const,
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    }),
  };
  return {
    client,
    body: new ResourceCache(client.fetchItemBody),
    comments: new ResourceCache(client.fetchComments),
    files: new ResourceCache(client.fetchPrFiles),
    commits: new ResourceCache(client.fetchPrCommits),
    relatedPrs: new ResourceCache(client.fetchRelatedPrs),
    state: new ResourceCache(client.fetchIssueState),
    prStatus: new ResourceCache(client.fetchPullRequestStatus),
  };
};

const buildOperations = (): ConsoleOperationsApi => ({
  reviewPullRequest: jest.fn(async () => {}),
  setNextActionDate: jest.fn(async () => {}),
  setStory: jest.fn(async () => {}),
  setStatus: jest.fn(async () => {}),
  setInTmuxByHuman: jest.fn(async () => {}),
  closeIssue: jest.fn(async () => {}),
  addComment: jest.fn(async () => ({
    author: 'HiromiShikata',
    body: 'comment body',
    createdAt: '2026-06-19T11:58:00.000Z',
  })),
  addInlineReviewComment: jest.fn(async () => {}),
});

describe('ConsoleItemDetailContainer', () => {
  it('queues the review action and commits it through the operations api for a PR item', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );
    await waitFor(() => {
      expect(getByText('Approve')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Approve'));
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({ type: 'review', action: 'approve' });
    expect(input.item).toBe(prItem);
    expect(operations.reviewPullRequest).not.toHaveBeenCalled();
    input.commit();
    expect(operations.reviewPullRequest).toHaveBeenCalledWith(
      prItem,
      prItem.url,
      'approve',
    );
  });

  it('routes an inline review comment on an issue related pull request to that pull request url', async () => {
    const operations = buildOperations();
    const relatedPullRequest = consoleRelatedPullRequestsFixture[0];
    const { container, findByRole, getAllByRole, getByPlaceholderText } =
      render(
        <ConsoleItemDetailContainer
          tab="unread"
          item={issueItem}
          caches={buildCaches({
            relatedPrs: [relatedPullRequest],
            prFiles: consoleChangedFilesFixture,
          })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={consoleStoryOptionsFixture}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={jest.fn()}
        />,
      );

    const fileRow = await findByRole('button', {
      name: new RegExp(consoleChangedFilesFixture[0].path),
    });
    fireEvent.click(fileRow);

    const commentButton = getAllByRole('button', {
      name: /^Comment on line/,
    })[0];
    fireEvent.click(commentButton);

    fireEvent.change(
      getByPlaceholderText('Leave a review comment on this line…'),
      { target: { value: 'Please rename this variable.' } },
    );
    const submitButton = container.querySelector(
      '.console-diff-composer-submit',
    );
    expect(submitButton).not.toBeNull();
    fireEvent.click(submitButton as Element);

    const addInlineReviewComment =
      operations.addInlineReviewComment as jest.Mock;
    await waitFor(() => {
      expect(addInlineReviewComment).toHaveBeenCalledTimes(1);
    });
    const call = addInlineReviewComment.mock.calls[0];
    expect(call[0]).toBe(relatedPullRequest.url);
    expect(call[4]).toBe('Please rename this variable.');
  });
});
