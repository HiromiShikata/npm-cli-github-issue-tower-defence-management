import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { ResourceCache } from '../lib/resourceCache';
import { AWAITING_WORKSPACE_NAME } from '../logic/operations';
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
  relatedPrsNeverResolve?: boolean;
};

const buildCaches = (overrides: CachesOverrides = {}): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => '# body',
    fetchComments: async () => [],
    fetchPrFiles: async () => overrides.prFiles ?? [],
    fetchPrCommits: async () => [],
    fetchRelatedPrs: async () =>
      overrides.relatedPrsNeverResolve === true
        ? new Promise<ConsoleRelatedPullRequest[]>(() => {})
        : (overrides.relatedPrs ?? []),
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
  okAndMoveToAwaitingWorkspace: jest.fn(async () => {}),
  addComment: jest.fn(async () => ({
    author: 'HiromiShikata',
    body: 'comment body',
    createdAt: '2026-06-19T11:58:00.000Z',
    url: null,
  })),
  uploadAttachment: jest.fn(async () => ''),
  addInlineReviewComment: jest.fn(async () => {}),
  deleteAllComments: jest.fn(async () => {}),
  setDependedIssueUrl: jest.fn(async () => {}),
});

const findCommentsPanelToggle = (container: HTMLElement): HTMLElement => {
  const toggle = Array.from(
    container.querySelectorAll('.console-panel-toggle'),
  ).find((element) =>
    element
      .querySelector('.console-panel-title')
      ?.textContent?.startsWith('Comments'),
  );
  if (toggle === undefined) {
    throw new Error('Comments panel toggle is not rendered');
  }
  return toggle as HTMLElement;
};

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
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );
    await waitFor(() => {
      expect(getByText('Approve & Merge')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Approve & Merge'));
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({ type: 'review', action: 'approve_and_merge' });
    expect(input.item).toBe(prItem);
    expect(operations.reviewPullRequest).not.toHaveBeenCalled();
    input.commit();
    expect(operations.reviewPullRequest).toHaveBeenCalledWith(
      prItem,
      prItem.url,
      'approve_and_merge',
      [],
    );
  });

  it('renders the comment input as soon as the item detail opens, without any interaction', () => {
    const { getByPlaceholderText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );

    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });

  it('puts a posted comment in the scrolling comment list and leaves the sticky dock holding only the input', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
      url: null,
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'The dock must not grow with every comment.' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(
        container.querySelector('.console-comment-list')?.textContent,
      ).toContain('The dock must not grow with every comment.');
    });
    expect(
      container.querySelector('.console-detail-dock')?.textContent,
    ).not.toContain('The dock must not grow with every comment.');
    expect(
      container.querySelectorAll('.console-detail-dock .console-comment')
        .length,
    ).toBe(0);
  });

  it('leaves the collapsed comments panel of a pull request item collapsed after a comment is posted', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
      url: null,
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(findCommentsPanelToggle(container).textContent).toContain(
        'Comments (0)',
      );
    });
    expect(
      findCommentsPanelToggle(container).getAttribute('aria-expanded'),
    ).toBe('false');

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Posted from the pull request item.' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(findCommentsPanelToggle(container).textContent).toContain(
        'Comments (1)',
      );
    });
    expect(
      findCommentsPanelToggle(container).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(container.querySelector('.console-comment-list')).toBeNull();
  });

  it('keeps a reader-collapsed comments panel collapsed after a comment is posted on an issue item', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
      url: null,
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(findCommentsPanelToggle(container).textContent).toContain(
        'Comments (0)',
      );
    });
    fireEvent.click(findCommentsPanelToggle(container));
    expect(
      findCommentsPanelToggle(container).getAttribute('aria-expanded'),
    ).toBe('false');

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Posted from the issue item.' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(findCommentsPanelToggle(container).textContent).toContain(
        'Comments (1)',
      );
    });
    expect(
      findCommentsPanelToggle(container).getAttribute('aria-expanded'),
    ).toBe('false');
    expect(container.querySelector('.console-comment-list')).toBeNull();
  });

  it('shows Approve for an issue item from the generated related open pull request urls before the related pull requests are fetched', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const bakedPullRequestUrl =
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/pull/1372';
    const itemWithBakedPullRequest = {
      ...issueItem,
      relatedOpenPullRequestUrls: [bakedPullRequestUrl],
    };
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={itemWithBakedPullRequest}
        caches={buildCaches({ relatedPrsNeverResolve: true })}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );

    expect(getByText('Approve & Merge')).toBeInTheDocument();
    fireEvent.click(getByText('Approve & Merge'));
    const input = onQueueAction.mock.calls[0][0];
    input.commit();
    expect(operations.reviewPullRequest).toHaveBeenCalledWith(
      itemWithBakedPullRequest,
      bakedPullRequestUrl,
      'approve_and_merge',
      [],
    );
  });

  it('disables Reject until an inline comment is entered and then commits it as the request-changes review', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const {
      container,
      findByRole,
      getAllByRole,
      getByPlaceholderText,
      getByText,
    } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches({ prFiles: consoleChangedFilesFixture })}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );

    await waitFor(() => {
      expect(getByText('Reject')).toBeInTheDocument();
    });
    expect(getByText('Reject')).toBeDisabled();

    const fileRow = await findByRole('button', {
      name: new RegExp(
        consoleChangedFilesFixture[0].path.split('/').at(-1) ?? '',
      ),
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
    fireEvent.click(submitButton as Element);

    await waitFor(() => {
      expect(getByText('Reject')).not.toBeDisabled();
    });

    fireEvent.click(getByText('Reject'));
    const rejectInput = onQueueAction.mock.calls.at(-1)?.[0];
    expect(rejectInput.kind).toEqual({
      type: 'review',
      action: 'request_changes',
    });
    rejectInput.commit();
    const reviewCall = (
      operations.reviewPullRequest as jest.Mock
    ).mock.calls.at(-1);
    expect(reviewCall?.[2]).toBe('request_changes');
    expect(reviewCall?.[3]).toEqual([
      {
        path: consoleChangedFilesFixture[0].path,
        line: expect.any(Number),
        side: expect.stringMatching(/LEFT|RIGHT/),
        body: 'Please rename this variable.',
      },
    ]);
  });

  it('passes onSubmitAndMoveToAwaitingWorkspace to the composer when statusOptions includes Awaiting Workspace', () => {
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );
    expect(getByText('Comment & Awaiting Workspace')).toBeInTheDocument();
  });

  it('does not pass onSubmitAndMoveToAwaitingWorkspace to the composer when statusOptions does not include Awaiting Workspace', () => {
    const statusOptionsWithoutAwaitingWorkspace =
      consoleStatusOptionsFixture.filter(
        (o) => o.name !== AWAITING_WORKSPACE_NAME,
      );
    const { queryByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={statusOptionsWithoutAwaitingWorkspace}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
      />,
    );
    expect(queryByText('Comment & Awaiting Workspace')).toBeNull();
  });

  it('clicking Comment & Awaiting Workspace calls addComment and queues a set_status action for the Awaiting Workspace option', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));
    await waitFor(() => {
      expect(operations.addComment).toHaveBeenCalledWith(
        issueItem,
        'test comment body',
      );
    });
    expect(onQueueAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: { type: 'set_status', optionName: AWAITING_WORKSPACE_NAME },
        item: issueItem,
      }),
    );
  });

  it('queues the navigation action without waiting for the comment API response when Comment & Awaiting Workspace is clicked', async () => {
    const operations = buildOperations();
    let resolveAddComment: (() => void) | undefined;
    operations.addComment = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAddComment = () =>
            resolve({
              author: 'HiromiShikata',
              body: 'comment body',
              createdAt: '2026-06-19T11:58:00.000Z',
              url: null,
            });
        }),
    );
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));
    await waitFor(() => {
      expect(onQueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: { type: 'set_status', optionName: AWAITING_WORKSPACE_NAME },
        }),
      );
    });
    expect(operations.addComment).toHaveBeenCalled();
    resolveAddComment?.();
  });

  it('calls onCommentDraftChange with empty string before queuing the status change when Comment & Awaiting Workspace is clicked', async () => {
    const operations = buildOperations();
    const onCommentDraftChange = jest.fn();
    const onQueueAction = jest.fn();
    let draftClearedBeforeStatusQueued = false;
    let hasSetStatus = false;

    onCommentDraftChange.mockImplementation((draft: string) => {
      if (draft === '' && !hasSetStatus) {
        draftClearedBeforeStatusQueued = true;
      }
    });

    onQueueAction.mockImplementation((input: { kind: { type: string } }) => {
      if (input.kind.type === 'set_status') {
        hasSetStatus = true;
      }
    });

    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        initialCommentDraft="test comment body"
        onQueueAction={onQueueAction}
        onCommentDraftChange={onCommentDraftChange}
      />,
    );

    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    await waitFor(() => {
      expect(onQueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: { type: 'set_status', optionName: AWAITING_WORKSPACE_NAME },
        }),
      );
    });

    expect(draftClearedBeforeStatusQueued).toBe(true);
  });

  it('collects an inline comment on an issue related pull request diff, enables Reject, and submits it as the request-changes review for that pull request url', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const relatedPullRequest = consoleRelatedPullRequestsFixture[0];
    const issueItemWithRelatedPullRequest = {
      ...issueItem,
      relatedOpenPullRequestUrls: [relatedPullRequest.url],
    };
    const {
      container,
      findByRole,
      getAllByRole,
      getByPlaceholderText,
      getByText,
    } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItemWithRelatedPullRequest}
        caches={buildCaches({
          relatedPrs: [relatedPullRequest],
          prFiles: consoleChangedFilesFixture,
        })}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );

    await waitFor(() => {
      expect(getByText('Reject')).toBeInTheDocument();
    });
    expect(getByText('Reject')).toBeDisabled();

    const fileRow = await findByRole('button', {
      name: new RegExp(
        consoleChangedFilesFixture[0].path.split('/').at(-1) ?? '',
      ),
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

    await waitFor(() => {
      expect(getByText('Reject')).not.toBeDisabled();
    });
    expect(operations.addInlineReviewComment).not.toHaveBeenCalled();

    fireEvent.click(getByText('Reject'));
    const rejectInput = onQueueAction.mock.calls.at(-1)?.[0];
    expect(rejectInput.kind).toEqual({
      type: 'review',
      action: 'request_changes',
    });
    rejectInput.commit();
    const reviewCall = (
      operations.reviewPullRequest as jest.Mock
    ).mock.calls.at(-1);
    expect(reviewCall?.[1]).toBe(relatedPullRequest.url);
    expect(reviewCall?.[2]).toBe('request_changes');
    expect(reviewCall?.[3]).toEqual([
      {
        path: consoleChangedFilesFixture[0].path,
        line: expect.any(Number),
        side: expect.stringMatching(/LEFT|RIGHT/),
        body: 'Please rename this variable.',
      },
    ]);
    expect(reviewCall?.[3][0].body).not.toBe('');
  });

  it('routes delete-all-comments through onQueueAction with the correct kind and commit', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-agent"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );

    await waitFor(() => {
      expect(getByText('⚠')).toBeInTheDocument();
    });

    fireEvent.click(getByText('⚠'));
    fireEvent.click(getByText('Delete All Comments'));

    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({ type: 'delete_all_comments' });
    expect(input.item).toBe(issueItem);
    expect(operations.deleteAllComments).not.toHaveBeenCalled();

    await input.commit();
    expect(operations.deleteAllComments).toHaveBeenCalledWith(issueItem);
  });

  it('surfaces errors from deleteAllComments via the queue rather than swallowing them', async () => {
    const operations = buildOperations();
    const error = new Error('GitHub API failure');
    (operations.deleteAllComments as jest.Mock).mockRejectedValue(error);
    const onQueueAction = jest.fn();
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-agent"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
      />,
    );

    await waitFor(() => {
      expect(getByText('⚠')).toBeInTheDocument();
    });

    fireEvent.click(getByText('⚠'));
    fireEvent.click(getByText('Delete All Comments'));

    const input = onQueueAction.mock.calls[0][0];
    await expect(input.commit()).rejects.toThrow('GitHub API failure');
  });
});
