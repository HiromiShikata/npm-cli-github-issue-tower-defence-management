import { act, fireEvent, render, waitFor } from '@testing-library/react';
import {
  ConsoleActionPartiallySentError,
  type ConsoleOfflinePayload,
} from '../hooks/useConsoleActionQueue';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import {
  buildTriageRequest,
  type ConsoleOperationsApi,
  TRIAGE_OPERATION_PATH,
} from '../hooks/useConsoleOperations';
import { COMMENT_OPERATION_PATH } from '../lib/consoleApi';
import { ResourceCache } from '../lib/resourceCache';
import { colorFromEnum } from '../logic/colors';
import { AWAITING_WORKSPACE_NAME } from '../logic/operations';
import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleListItem,
  ConsoleRelatedPullRequest,
  ConsoleStoryColorSource,
} from '../logic/types';
import {
  consoleAgentOptionsFixture,
  consoleChangedFilesFixture,
  consoleListItemsFixture,
  consoleRelatedPullRequestsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
  consoleStoryOptionsFixture,
} from '../testing/fixtures';
import {
  ConsoleItemDetailContainer,
  type ConsoleItemDetailContainerProps,
} from './ConsoleItemDetailContainer';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const prItem = consoleListItemsFixture[0];
const issueItem = consoleListItemsFixture[2];

type CachesOverrides = {
  relatedPrs?: ConsoleRelatedPullRequest[];
  prFiles?: ConsoleChangedFile[];
  relatedPrsNeverResolve?: boolean;
  body?: string;
  comments?: (ConsoleComment & { id: number })[];
};

const buildCaches = (overrides: CachesOverrides = {}): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => overrides.body ?? '# body',
    fetchComments: async () => overrides.comments ?? [],
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

const buildOperations = (): ConsoleOperationsApi => {
  const operations = {
    reviewPullRequest: jest.fn(async () => {}),
    setNextActionDate: jest.fn(async () => {}),
    setStory: jest.fn(async () => {}),
    setAgent: jest.fn(async () => {}),
    setStatus: jest.fn(async () => {}),
    setInTmuxByHuman: jest.fn(async () => {}),
    closeIssue: jest.fn(async () => {}),
    okAndMoveToAwaitingWorkspace: jest.fn(async () => {}),
    addComment: jest.fn(async () => ({
      id: 1,
      author: 'HiromiShikata',
      body: 'comment body',
      createdAt: '2026-06-19T11:58:00.000Z',
    })),
    addCommentAndMoveToAwaitingWorkspace: jest.fn(async () => ({
      id: 1,
      author: 'HiromiShikata',
      body: 'comment body',
      createdAt: '2026-06-19T11:58:00.000Z',
    })),
    uploadAttachment: jest.fn(async () => ''),
    addInlineReviewComment: jest.fn(async () => {}),
    issueRename: jest.fn(async () => {}),
    deleteAllComments: jest.fn(async () => {}),
    setDependedIssueUrl: jest.fn(async () => {}),
  };
  return operations;
};

type OperationsWithAtomicAwaitingWorkspace = ConsoleOperationsApi & {
  addCommentAndMoveToAwaitingWorkspace: jest.Mock;
};

const buildOperationsWithAtomicAwaitingWorkspace = (
  addCommentAndMoveToAwaitingWorkspace: jest.Mock,
): OperationsWithAtomicAwaitingWorkspace => ({
  ...buildOperations(),
  addCommentAndMoveToAwaitingWorkspace,
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });

  it('puts a posted comment in the scrolling comment list and leaves the sticky dock holding only the input', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      id: 2,
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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

  it('expands the comments panel of a pull request item by default and shows a posted comment', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      id: 2,
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(findCommentsPanelToggle(container).textContent).toContain(
        'Comments (0)',
      );
    });
    expect(
      findCommentsPanelToggle(container).getAttribute('aria-expanded'),
    ).toBe('true');

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
    ).toBe('true');
    expect(container.querySelector('.console-comment-list')).not.toBeNull();
  });

  it('keeps a reader-collapsed comments panel collapsed after a comment is posted on an issue item', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async (_item, body) => ({
      id: 2,
      author: 'HiromiShikata',
      body,
      createdAt: '2026-06-19T11:58:00.000Z',
    }));
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    expect(queryByText('Comment & Awaiting Workspace')).toBeNull();
  });

  it('clicking Comment & Awaiting Workspace queues exactly one action whose commit atomically posts the comment and the status through addCommentAndMoveToAwaitingWorkspace', async () => {
    const postedComment = {
      author: 'HiromiShikata',
      body: 'test comment body',
      createdAt: '2026-06-19T11:58:00.000Z',
    };
    const addCommentAndMoveToAwaitingWorkspace = jest.fn(
      async () => postedComment,
    );
    const operations = buildOperationsWithAtomicAwaitingWorkspace(
      addCommentAndMoveToAwaitingWorkspace,
    );
    const onQueueAction = jest.fn();
    const { container, getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({
      type: 'set_status',
      optionName: AWAITING_WORKSPACE_NAME,
    });
    expect(input.item).toBe(issueItem);
    expect(input.overlayPatch).toEqual({
      done: true,
      status: { name: 'Awaiting Workspace', color: 'BLUE' },
    });
    expect(addCommentAndMoveToAwaitingWorkspace).not.toHaveBeenCalled();
    expect(operations.addComment).not.toHaveBeenCalled();
    expect(operations.setStatus).not.toHaveBeenCalled();

    await input.commit();

    expect(addCommentAndMoveToAwaitingWorkspace).toHaveBeenCalledWith(
      issueItem,
      'test comment body',
      { id: 'd1c19cce', name: 'Awaiting Workspace', color: 'BLUE' },
    );
    expect(operations.addComment).not.toHaveBeenCalled();
    expect(operations.setStatus).not.toHaveBeenCalled();
    expect(onQueueAction).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(
        container.querySelector('.console-comment-list')?.textContent,
      ).toContain('test comment body');
    });
  });

  it('does not call addCommentAndMoveToAwaitingWorkspace merely from clicking Comment & Awaiting Workspace; only the queued commit triggers it', async () => {
    let resolveAddCommentAndMoveToAwaitingWorkspace: (() => void) | undefined;
    const addCommentAndMoveToAwaitingWorkspace = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAddCommentAndMoveToAwaitingWorkspace = () =>
            resolve({
              author: 'HiromiShikata',
              body: 'test comment body',
              createdAt: '2026-06-19T11:58:00.000Z',
            });
        }),
    );
    const operations = buildOperationsWithAtomicAwaitingWorkspace(
      addCommentAndMoveToAwaitingWorkspace,
    );
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({
      type: 'set_status',
      optionName: AWAITING_WORKSPACE_NAME,
    });
    expect(addCommentAndMoveToAwaitingWorkspace).not.toHaveBeenCalled();

    const commitPromise = input.commit();
    await waitFor(() => {
      expect(addCommentAndMoveToAwaitingWorkspace).toHaveBeenCalled();
    });
    resolveAddCommentAndMoveToAwaitingWorkspace?.();
    await commitPromise;
  });

  it.each<[string, Error]>([
    ['comment POST failing', new Error('comment post failed')],
    [
      'status POST failing after the comment already posted',
      new Error('status post failed after comment already posted'),
    ],
  ])(
    'invoking commit calls onCommentError and rejects the commit promise when addCommentAndMoveToAwaitingWorkspace fails from %s',
    async (_label, cause) => {
      const addCommentAndMoveToAwaitingWorkspace = jest.fn(async () => {
        throw cause;
      });
      const operations = buildOperationsWithAtomicAwaitingWorkspace(
        addCommentAndMoveToAwaitingWorkspace,
      );
      const onCommentError = jest.fn();
      const onQueueAction = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches()}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
          onCommentError={onCommentError}
        />,
      );
      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'test comment body' },
      });
      fireEvent.click(getByText('Comment & Awaiting Workspace'));

      expect(onQueueAction).toHaveBeenCalledTimes(1);
      const input = onQueueAction.mock.calls[0][0];

      await expect(input.commit()).rejects.toBe(cause);

      expect(onCommentError).toHaveBeenCalledWith(
        expect.any(String),
        String(cause),
      );
      expect(onQueueAction).toHaveBeenCalledTimes(1);
      expect(operations.addComment).not.toHaveBeenCalled();
      expect(operations.setStatus).not.toHaveBeenCalled();
    },
  );

  it('surfaces a message to onCommentError for the status-set phase failing after the comment already posted that differs from the message shown when the comment POST itself fails', async () => {
    const commentPostFailureCause = new Error('comment post failed');
    const statusSetFailureAfterCommentPostedCause = new Error(
      'status post failed after comment already posted',
    );

    const commitAndCaptureCommentErrorMessage = async (
      cause: Error,
    ): Promise<string> => {
      const addCommentAndMoveToAwaitingWorkspace = jest.fn(async () => {
        throw cause;
      });
      const operations = buildOperationsWithAtomicAwaitingWorkspace(
        addCommentAndMoveToAwaitingWorkspace,
      );
      const onCommentError = jest.fn();
      const onQueueAction = jest.fn();
      const { getByPlaceholderText, getByText, unmount } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches()}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
          onCommentError={onCommentError}
        />,
      );
      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'test comment body' },
      });
      fireEvent.click(getByText('Comment & Awaiting Workspace'));

      const input = onQueueAction.mock.calls[0][0];
      await expect(input.commit()).rejects.toBe(cause);
      expect(onCommentError).toHaveBeenCalledTimes(1);
      const message = onCommentError.mock.calls[0][0] as string;
      unmount();
      return message;
    };

    const commentPostFailureMessage = await commitAndCaptureCommentErrorMessage(
      commentPostFailureCause,
    );
    const statusSetFailureAfterCommentPostedMessage =
      await commitAndCaptureCommentErrorMessage(
        statusSetFailureAfterCommentPostedCause,
      );

    expect(statusSetFailureAfterCommentPostedMessage).not.toBe(
      commentPostFailureMessage,
    );
    expect(statusSetFailureAfterCommentPostedMessage).not.toBe(
      'Failed to post comment',
    );
  });

  it('does not call addCommentAndMoveToAwaitingWorkspace a second time when the operator retries after the status-set phase failed and the comment had already posted', async () => {
    const statusSetFailureAfterCommentPostedCause = new Error(
      'status post failed after comment already posted',
    );
    const addCommentAndMoveToAwaitingWorkspace = jest
      .fn()
      .mockRejectedValueOnce(statusSetFailureAfterCommentPostedCause)
      .mockResolvedValueOnce({
        author: 'HiromiShikata',
        body: 'test comment body',
        createdAt: '2026-06-19T11:58:00.000Z',
      });
    const operations = buildOperationsWithAtomicAwaitingWorkspace(
      addCommentAndMoveToAwaitingWorkspace,
    );
    const onCommentError = jest.fn();
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCommentError={onCommentError}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    const input = onQueueAction.mock.calls[0][0];
    await expect(input.commit()).rejects.toBe(
      statusSetFailureAfterCommentPostedCause,
    );
    expect(addCommentAndMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);

    await input.commit();

    expect(addCommentAndMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
  });

  it('calls onAfterMoveToAwaitingWorkspace after a successful status-set retry following a status-set phase failure', async () => {
    const statusSetFailureAfterCommentPostedCause = new Error(
      'status post failed after comment already posted',
    );
    const addCommentAndMoveToAwaitingWorkspace = jest
      .fn()
      .mockRejectedValueOnce(statusSetFailureAfterCommentPostedCause);
    const onAfterMoveToAwaitingWorkspace = jest.fn(async () => {});
    const operations = {
      ...buildOperationsWithAtomicAwaitingWorkspace(
        addCommentAndMoveToAwaitingWorkspace,
      ),
      onAfterMoveToAwaitingWorkspace,
    };
    const onCommentError = jest.fn();
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCommentError={onCommentError}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    const input = onQueueAction.mock.calls[0][0];
    await expect(input.commit()).rejects.toBe(
      statusSetFailureAfterCommentPostedCause,
    );
    expect(onAfterMoveToAwaitingWorkspace).not.toHaveBeenCalled();

    await input.commit();

    expect(operations.setStatus).toHaveBeenCalledTimes(1);
    expect(onAfterMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
  });

  it('resolves the retry commit and reports onCommentError, without rejecting, when onAfterMoveToAwaitingWorkspace rejects after a successful status-set retry following a status-set phase failure', async () => {
    const statusSetFailureAfterCommentPostedCause = new Error(
      'status post failed after comment already posted',
    );
    const onAfterMoveToAwaitingWorkspaceFailureCause = new Error(
      'onAfterMoveToAwaitingWorkspace failed after retry status-set succeeded',
    );
    const addCommentAndMoveToAwaitingWorkspace = jest
      .fn()
      .mockRejectedValueOnce(statusSetFailureAfterCommentPostedCause);
    const onAfterMoveToAwaitingWorkspace = jest.fn(async () => {
      throw onAfterMoveToAwaitingWorkspaceFailureCause;
    });
    const operations = {
      ...buildOperationsWithAtomicAwaitingWorkspace(
        addCommentAndMoveToAwaitingWorkspace,
      ),
      onAfterMoveToAwaitingWorkspace,
    };
    const onCommentError = jest.fn();
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCommentError={onCommentError}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    const input = onQueueAction.mock.calls[0][0];
    await expect(input.commit()).rejects.toBe(
      statusSetFailureAfterCommentPostedCause,
    );
    onCommentError.mockClear();

    await expect(input.commit()).resolves.toBeUndefined();

    expect(operations.setStatus).toHaveBeenCalledTimes(1);
    expect(onAfterMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
    expect(onCommentError).toHaveBeenCalledTimes(1);
    expect(onCommentError).toHaveBeenCalledWith(
      expect.any(String),
      String(onAfterMoveToAwaitingWorkspaceFailureCause),
    );

    const message = onCommentError.mock.calls[0][0] as string;
    expect(message).not.toBe(
      `Comment already posted, but retrying the move to Awaiting Workspace status failed: ${String(onAfterMoveToAwaitingWorkspaceFailureCause)}`,
    );
    expect(message).not.toBe('Failed to post comment');
  });

  it('re-throws the error from addCommentAndMoveToAwaitingWorkspace once commit runs, so the composer shows the error state', async () => {
    const error = new Error('network failure');
    const addCommentAndMoveToAwaitingWorkspace = jest.fn(async () => {
      throw error;
    });
    const operations = buildOperationsWithAtomicAwaitingWorkspace(
      addCommentAndMoveToAwaitingWorkspace,
    );
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText, findByRole } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'test comment body' },
    });
    fireEvent.click(getByText('Comment & Awaiting Workspace'));

    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({
      type: 'set_status',
      optionName: AWAITING_WORKSPACE_NAME,
    });

    await expect(input.commit()).rejects.toBe(error);

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('network failure');
    expect(onQueueAction).toHaveBeenCalledTimes(1);
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        initialCommentDraft="test comment body"
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
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

  it('queues the set_story action when a story option is selected', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByRole, getByTitle } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByTitle('Change agent or story'));
    const storySelect = getByRole('combobox', { name: 'Set story' });
    fireEvent.change(storySelect, { target: { value: '28415d6c' } });
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({
      type: 'set_story',
      optionName: 'regular / workflow improvement',
    });
    expect(input.item).toBe(issueItem);
    expect(operations.setStory).not.toHaveBeenCalled();
    input.commit();
    expect(operations.setStory).toHaveBeenCalledWith(issueItem, {
      id: '28415d6c',
      name: 'regular / workflow improvement',
      color: 'GRAY',
    });
  });

  it('queues the set_story action with an overlayPatch that carries the selected story option id alongside its name and color', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByRole, getByTitle } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByTitle('Change agent or story'));
    const storySelect = getByRole('combobox', { name: 'Set story' });
    fireEvent.change(storySelect, { target: { value: '28415d6c' } });
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.overlayPatch).toEqual({
      done: true,
      story: {
        id: '28415d6c',
        name: 'regular / workflow improvement',
        color: 'GRAY',
      },
    });
  });

  it('resolves the displayed story color by the story option id rather than by the story display name', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const storyColorsKeyedByNameAndById: ConsoleStoryColorSource = {
      'TDPM Console port': { color: 'RED' },
      'story-option-resolved-by-id': { color: 'PURPLE' },
    };
    const { container } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={[]}
        storyColors={storyColorsKeyedByNameAndById}
        storyName="TDPM Console port"
        storyOptionId="story-option-resolved-by-id"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    const dot = container.querySelector('.console-story-dot') as HTMLElement;
    expect(dot).toHaveStyle({ backgroundColor: colorFromEnum('PURPLE').dot });
    expect(dot.style.backgroundColor).not.toBe(colorFromEnum('RED').dot);
  });

  it('pre-selects the story dropdown by the resolved story option id, not by the first same-named option, when two story options share a display name', () => {
    const collidingStoryOptions = [
      { id: 'story_1', name: 'regular / A', color: 'BLUE' as const },
      { id: 'story_2', name: 'regular / A', color: 'RED' as const },
    ];
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByRole, getByTitle } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={collidingStoryOptions}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="regular / A"
        storyOptionId="story_2"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByTitle('Change agent or story'));
    const storySelect = getByRole('combobox', {
      name: 'Set story',
    }) as HTMLSelectElement;
    expect(storySelect.value).toBe('story_2');
  });

  it('queues the set_agent action when an agent option is selected', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByRole, getByTitle } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={consoleAgentOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByTitle('Change agent or story'));
    const agentSelect = getByRole('combobox', { name: 'Set agent' });
    fireEvent.change(agentSelect, { target: { value: '95c55dd3' } });
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.kind).toEqual({ type: 'set_agent', optionName: 'developer' });
    expect(input.item).toBe(issueItem);
    expect(operations.setAgent).not.toHaveBeenCalled();
    input.commit();
    expect(operations.setAgent).toHaveBeenCalledWith(issueItem, {
      id: '95c55dd3',
      name: 'developer',
      color: 'GRAY',
    });
  });

  it('pre-selects the agent dropdown by the item agentOptionId rather than by the agent display name', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const duplicateNameAgentOptions = [
      { id: 'agent-first', name: 'developer', color: 'GRAY' as const },
      { id: 'agent-second', name: 'developer', color: 'BLUE' as const },
    ];
    const itemWithAgentOptionId = {
      ...issueItem,
      agent: 'developer',
      agentOptionId: 'agent-second',
    };
    const { getByRole, getByTitle } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={itemWithAgentOptionId}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={duplicateNameAgentOptions}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByTitle('Change agent or story'));
    const agentSelect = getByRole('combobox', {
      name: 'Set agent',
    }) as HTMLSelectElement;
    expect(agentSelect.value).toBe('agent-second');
  });

  it('provides overlayPatch with done and status when ok & Awaiting Workspace is triggered', () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    fireEvent.click(getByText('ok & Awaiting Workspace'));
    expect(onQueueAction).toHaveBeenCalledTimes(1);
    const input = onQueueAction.mock.calls[0][0];
    expect(input.overlayPatch).toEqual({
      done: true,
      status: { name: 'Awaiting Workspace', color: 'BLUE' },
    });
  });

  it('clicking Comment & Close in the operations bar calls addComment then queues a close action', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { container, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    const textarea = container.querySelector(
      '.console-composer-input',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'closing comment' } });
    fireEvent.click(getByText('Comment & Close'));
    await waitFor(() => {
      expect(operations.addComment).toHaveBeenCalledWith(
        issueItem,
        'closing comment',
      );
    });
    expect(onQueueAction).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: { type: 'close', action: 'close' },
        item: issueItem,
      }),
    );
  });

  it('does not queue the close action when addComment throws via Comment & Close in the operations bar', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async () => {
      throw new Error('network error');
    });
    const onQueueAction = jest.fn();
    const { container, getByText, findByRole } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    const textarea = container.querySelector(
      '.console-composer-input',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'closing comment' } });
    fireEvent.click(getByText('Comment & Close'));
    await findByRole('alert');
    expect(onQueueAction).not.toHaveBeenCalledWith(
      expect.objectContaining({ kind: { type: 'close', action: 'close' } }),
    );
  });

  it('clicking OK & Close calls onQueueAction immediately even when addComment never resolves, and commit calls addComment then closeIssue', async () => {
    const operations = buildOperations();
    let resolveAddComment: (() => void) | undefined;
    operations.addComment = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAddComment = () =>
            resolve({
              id: 5,
              author: 'HiromiShikata',
              body: 'ok',
              createdAt: '2026-06-19T11:58:00.000Z',
            });
        }),
    );
    const onQueueAction = jest.fn();
    const { getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );
    fireEvent.click(getByText('OK & Close'));
    await waitFor(() => {
      expect(onQueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: { type: 'ok_and_close' },
          item: issueItem,
        }),
      );
    });
    expect(operations.addComment).not.toHaveBeenCalled();
    const input = onQueueAction.mock.calls[0][0];
    const commitPromise = input.commit();
    await waitFor(() => {
      expect(operations.addComment).toHaveBeenCalledWith(issueItem, 'ok');
    });
    expect(operations.closeIssue).not.toHaveBeenCalledWith(issueItem, 'close');
    resolveAddComment?.();
    await commitPromise;
    expect(operations.closeIssue).toHaveBeenCalledWith(issueItem, 'close');
  });

  it('calls operations.issueRename with the item and new title when the user saves via the title editor', async () => {
    const operations = buildOperations();
    (operations.issueRename as jest.Mock).mockResolvedValue(undefined);
    const onQueueAction = jest.fn();
    const { getByRole } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.change(getByRole('textbox', { name: 'Edit title' }), {
      target: { value: 'Renamed issue title' },
    });
    fireEvent.click(getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(operations.issueRename).toHaveBeenCalledWith(
        issueItem,
        'Renamed issue title',
      ),
    );
  });

  it('opens IssueCreateModalDialog with empty title and comment body as blockquote prefixed by item url and title when a comment create-workflow-issue button is clicked', async () => {
    const comment = {
      id: 1,
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const commentCaches = buildCaches();
    commentCaches.comments = new ResourceCache(async () => [comment]);
    const onCreateIssueFromComment = {
      onSubmitProject: jest.fn().mockResolvedValue(undefined),
      onSubmitWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    const { container } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={commentCaches}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    await waitFor(() => {
      expect(
        container.querySelector('.console-comment-create-workflow-issue'),
      ).not.toBeNull();
    });
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const titleTextarea = document.body.querySelector(
      '[aria-label="Title"]',
    ) as HTMLTextAreaElement | null;
    expect(titleTextarea).not.toBeNull();
    expect(titleTextarea?.value).toBe('');
    const bodyTextarea = document.body.querySelector(
      '[aria-label="Body"]',
    ) as HTMLTextAreaElement | null;
    expect(bodyTextarea).not.toBeNull();
    expect(bodyTextarea?.value).toBe(
      `${prItem.url}\n\n${prItem.title}\n\n\n\n\n\n> ${comment.body}`,
    );
  });

  it('includes comment body as blockquote in the dialog body when a comment create-workflow-issue button is clicked', async () => {
    const comment = {
      id: 1,
      author: 'HiromiShikata',
      body: 'Please split the token validation into its own tested function.',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const commentCaches = buildCaches();
    commentCaches.comments = new ResourceCache(async () => [comment]);
    const onCreateIssueFromComment = {
      onSubmitProject: jest.fn().mockResolvedValue(undefined),
      onSubmitWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    const { container } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={commentCaches}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    await waitFor(() => {
      expect(
        container.querySelector('.console-comment-create-workflow-issue'),
      ).not.toBeNull();
    });
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const bodyTextarea = document.body.querySelector(
      '[aria-label="Body"]',
    ) as HTMLTextAreaElement | null;
    expect(bodyTextarea).not.toBeNull();
    expect(bodyTextarea?.value).toContain(`> ${comment.body}`);
  });

  it('includes each line of multi-line comment body as its own blockquote line in the dialog body', async () => {
    const comment = {
      id: 1,
      author: 'HiromiShikata',
      body: 'First line\nSecond line\nThird line',
      createdAt: '2026-06-17T06:12:40.000Z',
    };
    const commentCaches = buildCaches();
    commentCaches.comments = new ResourceCache(async () => [comment]);
    const onCreateIssueFromComment = {
      onSubmitProject: jest.fn().mockResolvedValue(undefined),
      onSubmitWorkflow: jest.fn().mockResolvedValue(undefined),
    };
    const { container } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={commentCaches}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        onCreateIssueFromComment={onCreateIssueFromComment}
      />,
    );
    await waitFor(() => {
      expect(
        container.querySelector('.console-comment-create-workflow-issue'),
      ).not.toBeNull();
    });
    const btn = container.querySelector(
      '.console-comment-create-workflow-issue',
    );
    if (!btn) throw new Error('button not found');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });
    const bodyTextarea = document.body.querySelector(
      '[aria-label="Body"]',
    ) as HTMLTextAreaElement | null;
    expect(bodyTextarea).not.toBeNull();
    expect(bodyTextarea?.value).toBe(
      `${prItem.url}\n\n${prItem.title}\n\n\n\n\n\n> First line\n> Second line\n> Third line`,
    );
  });

  it.each<[string, Error]>([
    ['comment POST failing', new Error('comment post failed')],
    [
      'status POST failing after the comment already posted',
      new Error('status post failed after comment already posted'),
    ],
  ])(
    'invoking commit calls console.error and rejects the commit promise when addCommentAndMoveToAwaitingWorkspace fails from %s and onCommentError is not provided',
    async (_label, cause) => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const addCommentAndMoveToAwaitingWorkspace = jest.fn(async () => {
          throw cause;
        });
        const operations = buildOperationsWithAtomicAwaitingWorkspace(
          addCommentAndMoveToAwaitingWorkspace,
        );
        const onQueueAction = jest.fn();
        const { getByPlaceholderText, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches()}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );
        fireEvent.change(getByPlaceholderText('Leave a comment…'), {
          target: { value: 'test comment body' },
        });
        fireEvent.click(getByText('Comment & Awaiting Workspace'));

        expect(onQueueAction).toHaveBeenCalledTimes(1);
        const input = onQueueAction.mock.calls[0][0];

        await expect(input.commit()).rejects.toBe(cause);

        expect(consoleErrorSpy).toHaveBeenCalledWith(expect.any(String), cause);
        expect(onQueueAction).toHaveBeenCalledTimes(1);
        expect(operations.addComment).not.toHaveBeenCalled();
        expect(operations.setStatus).not.toHaveBeenCalled();
      } finally {
        consoleErrorSpy.mockRestore();
      }
    },
  );

  it('resolves the retry commit and calls console.error, without rejecting, when onAfterMoveToAwaitingWorkspace rejects after a successful status-set retry following a status-set phase failure and onCommentError is not provided', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const statusSetFailureAfterCommentPostedCause = new Error(
        'status post failed after comment already posted',
      );
      const onAfterMoveToAwaitingWorkspaceFailureCause = new Error(
        'onAfterMoveToAwaitingWorkspace failed after retry status-set succeeded',
      );
      const addCommentAndMoveToAwaitingWorkspace = jest
        .fn()
        .mockRejectedValueOnce(statusSetFailureAfterCommentPostedCause);
      const onAfterMoveToAwaitingWorkspace = jest.fn(async () => {
        throw onAfterMoveToAwaitingWorkspaceFailureCause;
      });
      const operations = {
        ...buildOperationsWithAtomicAwaitingWorkspace(
          addCommentAndMoveToAwaitingWorkspace,
        ),
        onAfterMoveToAwaitingWorkspace,
      };
      const onQueueAction = jest.fn();
      const { getByPlaceholderText, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches()}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );
      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: 'test comment body' },
      });
      fireEvent.click(getByText('Comment & Awaiting Workspace'));

      const input = onQueueAction.mock.calls[0][0];
      await expect(input.commit()).rejects.toBe(
        statusSetFailureAfterCommentPostedCause,
      );
      consoleErrorSpy.mockClear();

      await expect(input.commit()).resolves.toBeUndefined();

      expect(operations.setStatus).toHaveBeenCalledTimes(1);
      expect(onAfterMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        onAfterMoveToAwaitingWorkspaceFailureCause,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("hides every one of the button area's button groups at the same time the comment composer's own close control is activated (FR-001, FR-002, FR-004, SC-001)", async () => {
    const onQueueAction = jest.fn();
    const { getByText, getByTitle, queryByText, queryByTitle } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(getByText('Approve & Merge')).toBeInTheDocument();
    });
    expect(getByText('+1d')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
    expect(getByTitle('Change agent or story')).toBeInTheDocument();
    expect(getByTitle('Rare actions')).toBeInTheDocument();
    expect(getByText('⚠')).toBeInTheDocument();
    expect(getByText('Close as not planned')).toBeInTheDocument();
    expect(getByText('Close')).toBeInTheDocument();
    expect(getByText('✕ Close')).toBeInTheDocument();

    fireEvent.click(getByText('✕ Close'));

    expect(getByText('💬 Add a comment')).toBeInTheDocument();
    expect(queryByText('Approve & Merge')).toBeNull();
    expect(queryByText('+1d')).toBeNull();
    expect(queryByText('Awaiting Workspace')).toBeNull();
    expect(queryByTitle('Change agent or story')).toBeNull();
    expect(queryByTitle('Rare actions')).toBeNull();
    expect(queryByText('⚠')).toBeNull();
    expect(queryByText('Close as not planned')).toBeNull();
    expect(queryByText('Close')).toBeNull();
  });

  it("shows every button group again, in the same relative order as before, once the comment composer's own open control is activated after closing (FR-005, SC-002)", async () => {
    const onQueueAction = jest.fn();
    const { getByText, getByTitle, container } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(getByText('Approve & Merge')).toBeInTheDocument();
    });

    const precedes = (a: Element, b: Element): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

    const orderBeforeClose = [
      getByText('Approve & Merge'),
      getByText('+1d'),
      getByText('Awaiting Workspace'),
      getByTitle('Change agent or story'),
      getByTitle('Rare actions'),
      getByText('⚠'),
      getByText('Close'),
    ];
    for (let i = 0; i < orderBeforeClose.length - 1; i++) {
      expect(precedes(orderBeforeClose[i], orderBeforeClose[i + 1])).toBe(true);
    }

    fireEvent.click(getByText('✕ Close'));
    expect(container.querySelector('.console-op-group')).toBeNull();

    fireEvent.click(getByText('💬 Add a comment'));

    expect(getByText('✕ Close')).toBeInTheDocument();
    const orderAfterReopen = [
      getByText('Approve & Merge'),
      getByText('+1d'),
      getByText('Awaiting Workspace'),
      getByTitle('Change agent or story'),
      getByTitle('Rare actions'),
      getByText('⚠'),
      getByText('Close'),
    ];
    for (let i = 0; i < orderAfterReopen.length - 1; i++) {
      expect(precedes(orderAfterReopen[i], orderAfterReopen[i + 1])).toBe(true);
    }
  });

  it('never shows a caret-plus-Actions toggle control, whether the comment composer is open or closed (FR-003, SC-003)', async () => {
    const onQueueAction = jest.fn();
    const { container, getByText, queryByText } = render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        agentOptions={consoleAgentOptionsFixture}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(getByText('Approve & Merge')).toBeInTheDocument();
    });
    expect(queryByText('Actions')).toBeNull();
    expect(container.querySelector('.console-actionbar-toggle')).toBeNull();
    expect(container.querySelector('.console-actionbar-caret')).toBeNull();

    fireEvent.click(getByText('✕ Close'));

    expect(queryByText('Actions')).toBeNull();
    expect(container.querySelector('.console-actionbar-toggle')).toBeNull();
    expect(container.querySelector('.console-actionbar-caret')).toBeNull();
  });

  it("leaves the displayed Status, Agent, and Story values unchanged immediately after the comment composer's own close control is activated (FR-007, SC-004)", () => {
    const itemWithAgent = { ...issueItem, agent: 'developer' };
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { container, getByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={itemWithAgent}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    const statusChipTextBeforeClose = container.querySelector(
      '.console-detail-status-chip',
    )?.textContent;
    const agentChipTextBeforeClose = container.querySelector(
      '.console-detail-agent-chip',
    )?.textContent;
    const storyTagTextBeforeClose =
      container.querySelector('.console-storytag')?.textContent;
    expect(statusChipTextBeforeClose).toBe('Todo by human');
    expect(agentChipTextBeforeClose).toBe('developer');
    expect(storyTagTextBeforeClose).toBe('TDPM Console port');
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();

    fireEvent.click(getByText('✕ Close'));

    expect(getByText('💬 Add a comment')).toBeInTheDocument();
    expect(
      container.querySelector('.console-detail-status-chip')?.textContent,
    ).toBe(statusChipTextBeforeClose);
    expect(
      container.querySelector('.console-detail-agent-chip')?.textContent,
    ).toBe(agentChipTextBeforeClose);
    expect(container.querySelector('.console-storytag')?.textContent).toBe(
      storyTagTextBeforeClose,
    );
    expect(operations.setStatus).not.toHaveBeenCalled();
    expect(operations.setStory).not.toHaveBeenCalled();
    expect(operations.setAgent).not.toHaveBeenCalled();
    expect(operations.setNextActionDate).not.toHaveBeenCalled();
    expect(onQueueAction).not.toHaveBeenCalled();
  });

  it('opens the comment composer and shows the button area for a newly opened task regardless of how the previously viewed task was left (FR-006, SC-005)', async () => {
    const onQueueAction = jest.fn();
    const { getByText, queryByText, rerender } = render(
      <ConsoleItemDetailContainer
        key={prItem.projectItemId}
        tab="prs"
        item={prItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(getByText('Approve & Merge')).toBeInTheDocument();
    });
    fireEvent.click(getByText('✕ Close'));
    expect(getByText('💬 Add a comment')).toBeInTheDocument();
    expect(queryByText('Approve & Merge')).toBeNull();

    rerender(
      <ConsoleItemDetailContainer
        key={issueItem.projectItemId}
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    expect(getByText('✕ Close')).toBeInTheDocument();
    expect(getByText('Awaiting Workspace')).toBeInTheDocument();
  });

  it('closes the comment composer and hides the button area even while a comment post is in progress, the same way the close control already closes the composer unconditionally today (FR-008, SC-006)', async () => {
    const operations = buildOperations();
    let resolveAddComment: (() => void) | undefined;
    operations.addComment = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveAddComment = () =>
            resolve({
              id: 9,
              author: 'HiromiShikata',
              body: 'in-flight comment',
              createdAt: '2026-06-19T11:58:00.000Z',
            });
        }),
    );
    const onQueueAction = jest.fn();
    const { getByText, getByPlaceholderText, queryByText } = render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={operations}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={onQueueAction}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(getByText('⚠')).toBeInTheDocument();
    });

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'in-flight comment' },
    });
    fireEvent.click(getByText('Comment'));
    await waitFor(() => {
      expect(getByText('Posting…')).toBeInTheDocument();
    });

    fireEvent.click(getByText('✕ Close'));

    expect(getByText('💬 Add a comment')).toBeInTheDocument();
    expect(queryByText('⚠')).toBeNull();
    expect(queryByText('Close')).toBeNull();
    expect(queryByText('Awaiting Workspace')).toBeNull();

    await act(async () => {
      resolveAddComment?.();
    });
  });

  describe('task-list checkbox interactivity', () => {
    type OperationsWithCheckboxUpdates = ConsoleOperationsApi & {
      issueBodyUpdate: jest.Mock;
      issueCommentBodyUpdate: jest.Mock;
    };

    const buildOperationsWithCheckboxUpdates =
      (): OperationsWithCheckboxUpdates =>
        ({
          ...buildOperations(),
          issueBodyUpdate: jest.fn(async () => {}),
          issueCommentBodyUpdate: jest.fn(async () => {}),
        }) as unknown as OperationsWithCheckboxUpdates;

    it('calls operations.issueBodyUpdate with the item and the toggled body text when a checkbox in the Description panel is clicked', async () => {
      const operations = buildOperationsWithCheckboxUpdates();
      const onQueueAction = jest.fn();
      const { container, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches({
            body: '- [ ] Alpha\n- [x] Beta',
            comments: [],
          })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(getByText('Alpha')).toBeInTheDocument();
      });

      const checkbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="0"]',
      );
      expect(checkbox).not.toBeNull();
      fireEvent.click(checkbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueBodyUpdate).toHaveBeenCalledWith(
          issueItem,
          '- [x] Alpha\n- [x] Beta',
        );
      });
    });

    it('composes the second toggle on top of the first, instead of overwriting it, when two Description panel checkboxes are clicked in sequence before either persistence call resolves or the cache refetches', async () => {
      const operations = buildOperationsWithCheckboxUpdates();
      const onQueueAction = jest.fn();
      const { container, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches({
            body: '- [ ] Alpha\n- [x] Beta',
            comments: [],
          })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(getByText('Alpha')).toBeInTheDocument();
      });

      const firstCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="0"]',
      );
      expect(firstCheckbox).not.toBeNull();
      fireEvent.click(firstCheckbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueBodyUpdate).toHaveBeenCalledWith(
          issueItem,
          '- [x] Alpha\n- [x] Beta',
        );
      });

      const secondCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="1"]',
      );
      expect(secondCheckbox).not.toBeNull();
      fireEvent.click(secondCheckbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueBodyUpdate).toHaveBeenLastCalledWith(
          issueItem,
          '- [x] Alpha\n- [ ] Beta',
        );
      });
      expect(operations.issueBodyUpdate).toHaveBeenCalledTimes(2);
    });

    it('reverts the Description panel checkbox to its prior checked state when issueBodyUpdate rejects', async () => {
      const bodyUpdateFailure = new Error('issue body update failed');
      const operations = {
        ...buildOperations(),
        issueBodyUpdate: jest.fn(async () => {
          throw bodyUpdateFailure;
        }),
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha\n- [x] Beta',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const checkbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="0"]',
        );
        expect(checkbox).not.toBeNull();
        fireEvent.click(checkbox as HTMLInputElement);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            bodyUpdateFailure,
          );
        });

        await waitFor(() => {
          const revertedCheckbox = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
          expect(revertedCheckbox?.checked).toBe(false);
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('reverting an earlier failed toggle does not discard a later toggle that already succeeded while the earlier one was still pending', async () => {
      const firstToggleFailure = new Error('first toggle failed');
      let rejectFirstToggle!: (error: Error) => void;
      const issueBodyUpdate = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirstToggle = reject;
            }),
        )
        .mockImplementationOnce(async () => {});
      const operations = {
        ...buildOperations(),
        issueBodyUpdate,
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha\n- [ ] Beta',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const firstCheckbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="0"]',
        );
        expect(firstCheckbox).not.toBeNull();
        fireEvent.click(firstCheckbox as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            1,
            issueItem,
            '- [x] Alpha\n- [ ] Beta',
          );
        });

        const secondCheckbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="1"]',
        );
        expect(secondCheckbox).not.toBeNull();
        fireEvent.click(secondCheckbox as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            2,
            issueItem,
            '- [x] Alpha\n- [x] Beta',
          );
        });

        rejectFirstToggle(firstToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            firstToggleFailure,
          );
        });

        await waitFor(() => {
          const alpha = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
          const beta = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="1"]',
          );
          expect(alpha?.checked).toBe(false);
          expect(beta?.checked).toBe(true);
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('toggles the Description panel checkbox the user actually clicked, not the index-colliding checkbox before it, when a Mermaid diagram sits between two checkboxes', async () => {
      const operations = buildOperationsWithCheckboxUpdates();
      const onQueueAction = jest.fn();
      const bodyWithCheckboxesAroundAMermaidDiagram =
        '- [ ] First\n```mermaid\ngraph TD; A-->B;\n```\n- [ ] Second';
      const { container, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches({
            body: bodyWithCheckboxesAroundAMermaidDiagram,
            comments: [],
          })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(getByText('First')).toBeInTheDocument();
        expect(getByText('Second')).toBeInTheDocument();
      });

      const checkboxesInDocumentOrder = Array.from(
        container.querySelectorAll<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index]',
        ),
      );
      expect(checkboxesInDocumentOrder).toHaveLength(2);
      const checkboxAfterTheMermaidDiagram = checkboxesInDocumentOrder[1];

      fireEvent.click(checkboxAfterTheMermaidDiagram);

      await waitFor(() => {
        expect(operations.issueBodyUpdate).toHaveBeenCalled();
      });
      expect(operations.issueBodyUpdate).toHaveBeenCalledWith(
        issueItem,
        '- [ ] First\n```mermaid\ngraph TD; A-->B;\n```\n- [x] Second',
      );
    });

    it('does not apply a stale revert when the same checkbox is toggled again before the first toggle persistence call settles', async () => {
      const firstToggleFailure = new Error('first toggle failed');
      let rejectFirstToggle!: (error: Error) => void;
      const issueBodyUpdate = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirstToggle = reject;
            }),
        )
        .mockImplementationOnce(async () => {});
      const operations = {
        ...buildOperations(),
        issueBodyUpdate,
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const checkbox = () =>
          container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
        expect(checkbox()).not.toBeNull();

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            1,
            issueItem,
            '- [x] Alpha',
          );
        });

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            2,
            issueItem,
            '- [ ] Alpha',
          );
        });

        rejectFirstToggle(firstToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            firstToggleFailure,
          );
        });

        await waitFor(() => {
          expect(checkbox()?.checked).toBe(false);
        });
        expect(checkbox()?.checked).toBe(false);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('reverts fully to the original state, not one flip short, when two toggles of the same checkbox both fail', async () => {
      const firstToggleFailure = new Error('first toggle failed');
      const secondToggleFailure = new Error('second toggle failed');
      let rejectFirstToggle!: (error: Error) => void;
      let rejectSecondToggle!: (error: Error) => void;
      const issueBodyUpdate = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirstToggle = reject;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectSecondToggle = reject;
            }),
        );
      const operations = {
        ...buildOperations(),
        issueBodyUpdate,
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const checkbox = () =>
          container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
        expect(checkbox()).not.toBeNull();

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            1,
            issueItem,
            '- [x] Alpha',
          );
        });

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            2,
            issueItem,
            '- [ ] Alpha',
          );
        });

        rejectSecondToggle(secondToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            secondToggleFailure,
          );
        });

        rejectFirstToggle(firstToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            firstToggleFailure,
          );
        });

        await waitFor(() => {
          expect(checkbox()?.checked).toBe(false);
        });
        expect(checkbox()?.checked).toBe(false);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('reflects an earlier toggle that succeeds after a later toggle of the same checkbox already failed and settled the display', async () => {
      let resolveFirstToggle!: () => void;
      const secondToggleFailure = new Error('second toggle failed');
      let rejectSecondToggle!: (error: Error) => void;
      const issueBodyUpdate = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveFirstToggle = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectSecondToggle = reject;
            }),
        );
      const operations = {
        ...buildOperations(),
        issueBodyUpdate,
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const checkbox = () =>
          container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
        expect(checkbox()).not.toBeNull();

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            1,
            issueItem,
            '- [x] Alpha',
          );
        });

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueBodyUpdate).toHaveBeenNthCalledWith(
            2,
            issueItem,
            '- [ ] Alpha',
          );
        });

        rejectSecondToggle(secondToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            secondToggleFailure,
          );
        });
        await waitFor(() => {
          expect(checkbox()?.checked).toBe(false);
        });

        resolveFirstToggle();

        await waitFor(() => {
          expect(checkbox()?.checked).toBe(true);
        });
        expect(checkbox()?.checked).toBe(true);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('calls operations.issueCommentBodyUpdate with the item, the comment id and the toggled comment body text when a checkbox inside a comment is clicked', async () => {
      const operations = buildOperationsWithCheckboxUpdates();
      const onQueueAction = jest.fn();
      const commentWithCheckbox: ConsoleComment & { id: number } = {
        id: 4242,
        author: 'HiromiShikata',
        body: '- [ ] Review the diff',
        createdAt: '2026-06-19T11:58:00.000Z',
      };
      const { container, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches({ comments: [commentWithCheckbox] })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(getByText('Review the diff')).toBeInTheDocument();
      });

      const checkbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="0"]',
      );
      expect(checkbox).not.toBeNull();
      fireEvent.click(checkbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueCommentBodyUpdate).toHaveBeenCalledWith(
          issueItem,
          4242,
          '- [x] Review the diff',
        );
      });
    });

    it('composes the second toggle on top of the first, instead of overwriting it, when two checkboxes inside the same comment are clicked in sequence', async () => {
      const operations = buildOperationsWithCheckboxUpdates();
      const onQueueAction = jest.fn();
      const commentWithCheckboxes: ConsoleComment & { id: number } = {
        id: 4242,
        author: 'HiromiShikata',
        body: '- [ ] Review the diff\n- [x] Approve the PR',
        createdAt: '2026-06-19T11:58:00.000Z',
      };
      const { container, getByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={issueItem}
          caches={buildCaches({ comments: [commentWithCheckboxes] })}
          operations={operations}
          statusOptions={consoleStatusOptionsFixture}
          storyOptions={[]}
          agentOptions={[]}
          storyColors={consoleStoryColorsFixture}
          storyName="TDPM Console port"
          overlayStatus={null}
          now={Date.parse('2026-06-19T12:00:00.000Z')}
          onQueueAction={onQueueAction}
          isAirplaneModeOn={false}
          onOfflineActionsCreate={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(getByText('Review the diff')).toBeInTheDocument();
      });

      const firstCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="0"]',
      );
      expect(firstCheckbox).not.toBeNull();
      fireEvent.click(firstCheckbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueCommentBodyUpdate).toHaveBeenCalledWith(
          issueItem,
          4242,
          '- [x] Review the diff\n- [x] Approve the PR',
        );
      });

      const secondCheckbox = container.querySelector<HTMLInputElement>(
        'input[type="checkbox"][data-checkbox-index="1"]',
      );
      expect(secondCheckbox).not.toBeNull();
      fireEvent.click(secondCheckbox as HTMLInputElement);

      await waitFor(() => {
        expect(operations.issueCommentBodyUpdate).toHaveBeenLastCalledWith(
          issueItem,
          4242,
          '- [x] Review the diff\n- [ ] Approve the PR',
        );
      });
      expect(operations.issueCommentBodyUpdate).toHaveBeenCalledTimes(2);
    });

    it('reverts a comment checkbox to its prior checked state when issueCommentBodyUpdate rejects', async () => {
      const commentUpdateFailure = new Error(
        'issue comment body update failed',
      );
      const commentWithCheckbox: ConsoleComment & { id: number } = {
        id: 4242,
        author: 'HiromiShikata',
        body: '- [ ] Review the diff',
        createdAt: '2026-06-19T11:58:00.000Z',
      };
      const operations = {
        ...buildOperations(),
        issueBodyUpdate: jest.fn(async () => {}),
        issueCommentBodyUpdate: jest.fn(async () => {
          throw commentUpdateFailure;
        }),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({ comments: [commentWithCheckbox] })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Review the diff')).toBeInTheDocument();
        });

        const checkbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="0"]',
        );
        expect(checkbox).not.toBeNull();
        fireEvent.click(checkbox as HTMLInputElement);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist comment checkbox toggle',
            commentUpdateFailure,
          );
        });

        await waitFor(() => {
          const revertedCheckbox = container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
          expect(revertedCheckbox?.checked).toBe(false);
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('does not apply a stale revert when the same comment checkbox is toggled again before the first toggle persistence call settles', async () => {
      const firstToggleFailure = new Error('first comment toggle failed');
      let rejectFirstToggle!: (error: Error) => void;
      const issueCommentBodyUpdate = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectFirstToggle = reject;
            }),
        )
        .mockImplementationOnce(async () => {});
      const commentWithCheckbox: ConsoleComment & { id: number } = {
        id: 4242,
        author: 'HiromiShikata',
        body: '- [ ] Review the diff',
        createdAt: '2026-06-19T11:58:00.000Z',
      };
      const operations = {
        ...buildOperations(),
        issueBodyUpdate: jest.fn(async () => {}),
        issueCommentBodyUpdate,
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({ comments: [commentWithCheckbox] })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Review the diff')).toBeInTheDocument();
        });

        const checkbox = () =>
          container.querySelector<HTMLInputElement>(
            'input[type="checkbox"][data-checkbox-index="0"]',
          );
        expect(checkbox()).not.toBeNull();

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueCommentBodyUpdate).toHaveBeenNthCalledWith(
            1,
            issueItem,
            4242,
            '- [x] Review the diff',
          );
        });

        fireEvent.click(checkbox() as HTMLInputElement);

        await waitFor(() => {
          expect(issueCommentBodyUpdate).toHaveBeenNthCalledWith(
            2,
            issueItem,
            4242,
            '- [ ] Review the diff',
          );
        });

        rejectFirstToggle(firstToggleFailure);

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist comment checkbox toggle',
            firstToggleFailure,
          );
        });

        await waitFor(() => {
          expect(checkbox()?.checked).toBe(false);
        });
        expect(checkbox()?.checked).toBe(false);
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('calls console.error and does not throw when issueBodyUpdate rejects after a Description panel checkbox is clicked', async () => {
      const bodyUpdateFailure = new Error('issue body update failed');
      const operations = {
        ...buildOperations(),
        issueBodyUpdate: jest.fn(async () => {
          throw bodyUpdateFailure;
        }),
        issueCommentBodyUpdate: jest.fn(async () => {}),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({
              body: '- [ ] Alpha\n- [x] Beta',
              comments: [],
            })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Alpha')).toBeInTheDocument();
        });

        const checkbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="0"]',
        );
        expect(checkbox).not.toBeNull();
        expect(() =>
          fireEvent.click(checkbox as HTMLInputElement),
        ).not.toThrow();

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist description checkbox toggle',
            bodyUpdateFailure,
          );
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it('calls console.error and does not throw when issueCommentBodyUpdate rejects after a comment checkbox is clicked', async () => {
      const commentUpdateFailure = new Error(
        'issue comment body update failed',
      );
      const commentWithCheckbox: ConsoleComment & { id: number } = {
        id: 4242,
        author: 'HiromiShikata',
        body: '- [ ] Review the diff',
        createdAt: '2026-06-19T11:58:00.000Z',
      };
      const operations = {
        ...buildOperations(),
        issueBodyUpdate: jest.fn(async () => {}),
        issueCommentBodyUpdate: jest.fn(async () => {
          throw commentUpdateFailure;
        }),
      } as unknown as OperationsWithCheckboxUpdates;
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      try {
        const onQueueAction = jest.fn();
        const { container, getByText } = render(
          <ConsoleItemDetailContainer
            tab="todo-by-human"
            item={issueItem}
            caches={buildCaches({ comments: [commentWithCheckbox] })}
            operations={operations}
            statusOptions={consoleStatusOptionsFixture}
            storyOptions={[]}
            agentOptions={[]}
            storyColors={consoleStoryColorsFixture}
            storyName="TDPM Console port"
            overlayStatus={null}
            now={Date.parse('2026-06-19T12:00:00.000Z')}
            onQueueAction={onQueueAction}
            isAirplaneModeOn={false}
            onOfflineActionsCreate={jest.fn()}
          />,
        );

        await waitFor(() => {
          expect(getByText('Review the diff')).toBeInTheDocument();
        });

        const checkbox = container.querySelector<HTMLInputElement>(
          'input[type="checkbox"][data-checkbox-index="0"]',
        );
        expect(checkbox).not.toBeNull();
        expect(() =>
          fireEvent.click(checkbox as HTMLInputElement),
        ).not.toThrow();

        await waitFor(() => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to persist comment checkbox toggle',
            commentUpdateFailure,
          );
        });
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});

describe('ConsoleItemDetailContainer composer comment delivery', () => {
  const renderIssueDetailForCommentDelivery = (
    overrides: Partial<ConsoleItemDetailContainerProps> = {},
  ) =>
    render(
      <ConsoleItemDetailContainer
        tab="todo-by-human"
        item={issueItem}
        caches={buildCaches()}
        operations={buildOperations()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={[]}
        agentOptions={[]}
        storyColors={consoleStoryColorsFixture}
        storyName="TDPM Console port"
        overlayStatus={null}
        now={Date.parse('2026-06-19T12:00:00.000Z')}
        onQueueAction={jest.fn()}
        isAirplaneModeOn={false}
        onOfflineActionsCreate={jest.fn()}
        pjcode="acme"
        {...overrides}
      />,
    );

  it('posts a composer comment once through operations.addComment with the item and the draft, without queuing an action', async () => {
    const operations = buildOperations();
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } =
      renderIssueDetailForCommentDelivery({ operations, onQueueAction });

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Reviewed on the train.' },
    });
    fireEvent.click(getByText('Comment'));

    await waitFor(() => {
      expect(operations.addComment).toHaveBeenCalledTimes(1);
    });
    expect(operations.addComment).toHaveBeenCalledWith(
      issueItem,
      'Reviewed on the train.',
    );
    expect(onQueueAction).not.toHaveBeenCalled();
  });

  it('shows a host rejection from operations.addComment as a composer failure and keeps the draft', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async () => {
      throw new Error('HTTP 500.');
    });
    const { container, getByPlaceholderText, getByText, findByRole } =
      renderIssueDetailForCommentDelivery({ operations });

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Rejected by the host.' },
    });
    fireEvent.click(getByText('Comment'));

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Failed: HTTP 500.');
    expect(
      (
        container.querySelector(
          '.console-composer-input',
        ) as HTMLTextAreaElement
      ).value,
    ).toBe('Rejected by the host.');
  });

  const offlinePayloadBaseFor = (item: ConsoleListItem) => ({
    itemUrl: item.url,
    projectItemId: item.projectItemId,
    itemNumber: item.number,
    repo: item.repo,
    nameWithOwner: item.nameWithOwner,
    isPr: item.isPr,
  });

  const commentOfflinePayloadFor = (
    item: ConsoleListItem,
    body: string,
  ): ConsoleOfflinePayload => ({
    ...offlinePayloadBaseFor(item),
    apiPath: COMMENT_OPERATION_PATH,
    requestBody: { pjcode: 'acme', url: item.url, body },
  });

  const triageOfflinePayloadFor = (
    item: ConsoleListItem,
    action: 'close' | 'set_status',
    extra?: { statusName: string },
  ): ConsoleOfflinePayload => ({
    ...offlinePayloadBaseFor(item),
    apiPath: TRIAGE_OPERATION_PATH,
    requestBody: {
      ...buildTriageRequest('acme', item, action, extra),
    },
  });

  const commentBodyWrittenOffline = 'Checked during the flight.';

  it.each([
    {
      condition: 'airplane mode is on',
      isAirplaneModeOn: true,
      addCommentResult: 'posted' as const,
      expectedAddCommentCalls: [],
      expectedHeldPayloadsPerCall: [
        [commentOfflinePayloadFor(issueItem, commentBodyWrittenOffline)],
      ],
    },
    {
      condition: 'the comment request fails because the network is unavailable',
      isAirplaneModeOn: false,
      addCommentResult: 'network failure' as const,
      expectedAddCommentCalls: [[issueItem, commentBodyWrittenOffline]],
      expectedHeldPayloadsPerCall: [
        [commentOfflinePayloadFor(issueItem, commentBodyWrittenOffline)],
      ],
    },
    {
      condition: 'airplane mode is off and the network is available',
      isAirplaneModeOn: false,
      addCommentResult: 'posted' as const,
      expectedAddCommentCalls: [[issueItem, commentBodyWrittenOffline]],
      expectedHeldPayloadsPerCall: [],
    },
  ])(
    'delivers the composer comment through the expected comment requests and offline holds when $condition',
    async ({
      isAirplaneModeOn,
      addCommentResult,
      expectedAddCommentCalls,
      expectedHeldPayloadsPerCall,
    }) => {
      const originalFetch = global.fetch;
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      try {
        const operations = buildOperations();
        if (addCommentResult === 'network failure') {
          operations.addComment = jest.fn(async () => {
            throw new TypeError('Failed to fetch');
          });
        }
        const onOfflineActionsCreate = jest.fn();
        const onQueueAction = jest.fn();
        const { getByPlaceholderText, getByText } =
          renderIssueDetailForCommentDelivery({
            operations,
            onQueueAction,
            isAirplaneModeOn,
            onOfflineActionsCreate,
          });

        fireEvent.change(getByPlaceholderText('Leave a comment…'), {
          target: { value: commentBodyWrittenOffline },
        });
        fireEvent.click(getByText('Comment'));

        await waitFor(() => {
          expect(
            (operations.addComment as jest.Mock).mock.calls.length +
              onOfflineActionsCreate.mock.calls.length,
          ).toBeGreaterThan(0);
        });
        await waitFor(() => {
          expect(
            onOfflineActionsCreate.mock.calls.map(([input]) => input.payloads),
          ).toEqual(expectedHeldPayloadsPerCall);
        });
        expect((operations.addComment as jest.Mock).mock.calls).toEqual(
          expectedAddCommentCalls,
        );
        expect(onQueueAction).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        global.fetch = originalFetch;
      }
    },
  );

  it('shows a host rejection of the composer comment and holds nothing in the offline queue', async () => {
    const operations = buildOperations();
    operations.addComment = jest.fn(async () => {
      throw new Error('HTTP 500.');
    });
    const onOfflineActionsCreate = jest.fn();
    const { getByPlaceholderText, getByText, findByRole } =
      renderIssueDetailForCommentDelivery({
        operations,
        onOfflineActionsCreate,
      });

    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Rejected by the host.' },
    });
    fireEvent.click(getByText('Comment'));

    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('Failed: HTTP 500.');
    expect(operations.addComment).toHaveBeenCalledTimes(1);
    expect(onOfflineActionsCreate).not.toHaveBeenCalled();
  });

  const draftWrittenBeforeClosing = 'Handled after landing.';

  it.each([
    {
      buttonLabel: 'OK & Close',
      expectedOffline: [
        commentOfflinePayloadFor(issueItem, 'ok'),
        triageOfflinePayloadFor(issueItem, 'close'),
      ],
    },
    {
      buttonLabel: 'ok & Awaiting Workspace',
      expectedOffline: [
        commentOfflinePayloadFor(issueItem, 'ok'),
        triageOfflinePayloadFor(issueItem, 'set_status', {
          statusName: AWAITING_WORKSPACE_NAME,
        }),
      ],
    },
    {
      buttonLabel: 'Comment & Close',
      expectedOffline: [
        commentOfflinePayloadFor(issueItem, draftWrittenBeforeClosing),
        triageOfflinePayloadFor(issueItem, 'close'),
      ],
    },
    {
      buttonLabel: 'Comment & Awaiting Workspace',
      expectedOffline: [
        commentOfflinePayloadFor(issueItem, draftWrittenBeforeClosing),
        triageOfflinePayloadFor(issueItem, 'set_status', {
          statusName: AWAITING_WORKSPACE_NAME,
        }),
      ],
    },
  ])(
    'queues $buttonLabel with an offline payload holding the comment before the status change',
    async ({ buttonLabel, expectedOffline }) => {
      const onQueueAction = jest.fn();
      const { getByPlaceholderText, getByText } =
        renderIssueDetailForCommentDelivery({ onQueueAction });

      fireEvent.change(getByPlaceholderText('Leave a comment…'), {
        target: { value: draftWrittenBeforeClosing },
      });
      fireEvent.click(getByText(buttonLabel));

      await waitFor(() => {
        expect(onQueueAction).toHaveBeenCalledWith(
          expect.objectContaining({ offline: expectedOffline }),
        );
      });
    },
  );

  const commentThenCloseActions = [
    { buttonLabel: 'OK & Close', expectedCommentBody: 'ok' },
    {
      buttonLabel: 'Comment & Close',
      expectedCommentBody: draftWrittenBeforeClosing,
    },
  ];

  const queuedCommitFor = async (
    buttonLabel: string,
    operations: ConsoleOperationsApi,
    overrides: Partial<ConsoleItemDetailContainerProps> = {},
  ): Promise<() => Promise<void>> => {
    const onQueueAction = jest.fn();
    const { getByPlaceholderText, getByText } =
      renderIssueDetailForCommentDelivery({
        operations,
        onQueueAction,
        ...overrides,
      });
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: draftWrittenBeforeClosing },
    });
    fireEvent.click(getByText(buttonLabel));
    await waitFor(() => {
      expect(onQueueAction).toHaveBeenCalledTimes(1);
    });
    return onQueueAction.mock.calls[0][0].commit;
  };

  it.each(commentThenCloseActions)(
    'commits $buttonLabel by posting the comment once and then closing the item once when both requests succeed',
    async ({ buttonLabel, expectedCommentBody }) => {
      const operations = buildOperations();
      const commit = await queuedCommitFor(buttonLabel, operations);

      await expect(commit()).resolves.toBeUndefined();

      expect((operations.addComment as jest.Mock).mock.calls).toEqual([
        [issueItem, expectedCommentBody],
      ]);
      expect((operations.closeIssue as jest.Mock).mock.calls).toEqual([
        [issueItem, 'close'],
      ]);
    },
  );

  it.each(commentThenCloseActions)(
    'rejects the $buttonLabel commit with the unchanged network error and never closes the item when the comment request fails because the network is unavailable',
    async ({ buttonLabel }) => {
      const networkFailure = new TypeError('Failed to fetch');
      const operations = buildOperations();
      operations.addComment = jest.fn(async () => {
        throw networkFailure;
      });
      const commit = await queuedCommitFor(buttonLabel, operations);

      await expect(commit()).rejects.toBe(networkFailure);

      expect(operations.addComment).toHaveBeenCalledTimes(1);
      expect(operations.closeIssue).not.toHaveBeenCalled();
    },
  );

  const closeFailures = [
    {
      closeFailureKind: 'fails because the network is unavailable',
      buildCloseFailure: (): Error => new TypeError('Failed to fetch'),
    },
    {
      closeFailureKind: 'is rejected by the host',
      buildCloseFailure: (): Error => new Error('HTTP 500 close refused'),
    },
  ];

  it.each(
    commentThenCloseActions.flatMap((commentThenCloseAction) =>
      closeFailures.map((closeFailure) => ({
        ...commentThenCloseAction,
        ...closeFailure,
      })),
    ),
  )(
    'rejects the $buttonLabel commit with a partially sent error counting the posted comment when the comment is posted and the close $closeFailureKind',
    async ({ buttonLabel, expectedCommentBody, buildCloseFailure }) => {
      const closeFailure = buildCloseFailure();
      const operations = buildOperations();
      operations.closeIssue = jest.fn(async () => {
        throw closeFailure;
      });
      const commit = await queuedCommitFor(buttonLabel, operations);

      const rejection = await commit().then(
        () => null,
        (error: unknown) => error,
      );

      expect(rejection).toBeInstanceOf(ConsoleActionPartiallySentError);
      expect(rejection).toMatchObject({ sentStepCount: 1 });
      expect((rejection as ConsoleActionPartiallySentError).cause).toBe(
        closeFailure,
      );
      expect((operations.addComment as jest.Mock).mock.calls).toEqual([
        [issueItem, expectedCommentBody],
      ]);
      expect((operations.closeIssue as jest.Mock).mock.calls).toEqual([
        [issueItem, 'close'],
      ]);
    },
  );

  const queuedCommitResumingFromSentStepCountFor = async (
    buttonLabel: string,
    operations: ConsoleOperationsApi,
  ): Promise<(sentStepCount: number) => Promise<void>> =>
    queuedCommitFor(buttonLabel, operations);

  it.each(commentThenCloseActions)(
    'commits $buttonLabel told that no step was sent by posting the comment once and then closing the item once',
    async ({ buttonLabel, expectedCommentBody }) => {
      const operations = buildOperations();
      const commit = await queuedCommitResumingFromSentStepCountFor(
        buttonLabel,
        operations,
      );

      await expect(commit(0)).resolves.toBeUndefined();

      const addCommentMock = operations.addComment as jest.Mock;
      const closeIssueMock = operations.closeIssue as jest.Mock;
      expect(addCommentMock.mock.calls).toEqual([
        [issueItem, expectedCommentBody],
      ]);
      expect(closeIssueMock.mock.calls).toEqual([[issueItem, 'close']]);
      expect(addCommentMock.mock.invocationCallOrder[0]).toBeLessThan(
        closeIssueMock.mock.invocationCallOrder[0],
      );
    },
  );

  it.each(commentThenCloseActions)(
    'commits $buttonLabel told that the comment step was sent by closing the item once without posting the comment again',
    async ({ buttonLabel }) => {
      const operations = buildOperations();
      const commit = await queuedCommitResumingFromSentStepCountFor(
        buttonLabel,
        operations,
      );

      await expect(commit(1)).resolves.toBeUndefined();

      expect(operations.addComment).not.toHaveBeenCalled();
      expect((operations.closeIssue as jest.Mock).mock.calls).toEqual([
        [issueItem, 'close'],
      ]);
    },
  );

  it.each(
    commentThenCloseActions.flatMap((commentThenCloseAction) =>
      closeFailures.map((closeFailure) => ({
        ...commentThenCloseAction,
        ...closeFailure,
      })),
    ),
  )(
    'rejects the $buttonLabel commit told that the comment step was sent with a partially sent error counting the comment, without posting the comment again, when the close $closeFailureKind',
    async ({ buttonLabel, buildCloseFailure }) => {
      const closeFailure = buildCloseFailure();
      const operations = buildOperations();
      operations.closeIssue = jest.fn(async () => {
        throw closeFailure;
      });
      const commit = await queuedCommitResumingFromSentStepCountFor(
        buttonLabel,
        operations,
      );

      const rejection = await commit(1).then(
        () => null,
        (error: unknown) => error,
      );

      expect(rejection).toBeInstanceOf(ConsoleActionPartiallySentError);
      expect(rejection).toMatchObject({ sentStepCount: 1 });
      expect((rejection as ConsoleActionPartiallySentError).cause).toBe(
        closeFailure,
      );
      expect(operations.addComment).not.toHaveBeenCalled();
      expect((operations.closeIssue as jest.Mock).mock.calls).toEqual([
        [issueItem, 'close'],
      ]);
    },
  );

  it('rejects the Comment & Awaiting Workspace commit with the partially sent error without reporting a comment error when the comment was posted and the move to Awaiting Workspace fails because the network is unavailable', async () => {
    const partiallySentError = new ConsoleActionPartiallySentError(
      1,
      new TypeError('Failed to fetch'),
    );
    const addCommentAndMoveToAwaitingWorkspace = jest.fn(async () => {
      throw partiallySentError;
    });
    const onCommentError = jest.fn();
    const commit = await queuedCommitFor(
      'Comment & Awaiting Workspace',
      buildOperationsWithAtomicAwaitingWorkspace(
        addCommentAndMoveToAwaitingWorkspace,
      ),
      { onCommentError },
    );

    await expect(commit()).rejects.toBe(partiallySentError);

    expect(addCommentAndMoveToAwaitingWorkspace).toHaveBeenCalledTimes(1);
    expect(onCommentError).not.toHaveBeenCalled();
  });
});
