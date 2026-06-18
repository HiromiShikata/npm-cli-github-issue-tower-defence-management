import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  consoleItemBodyFixture,
  consoleListItemsFixture,
  consolePullRequestDetailFixture,
  consoleStatusOptionsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import type { ConsoleApiClient } from '../hooks/consoleApiClient';
import type { ConsoleItemCache } from '../hooks/consoleItemCache';
import { ConsoleItemDetailContainer } from './ConsoleItemDetailContainer';

jest.mock('mermaid', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    render: jest.fn(async () => ({ svg: '<svg></svg>' })),
  },
}));

const createCache = (): ConsoleItemCache => ({
  getItemBody: jest.fn(async () => consoleItemBodyFixture),
  getComments: jest.fn(async () => consoleItemBodyFixture.comments),
  getRelatedPullRequests: jest.fn(async () => []),
  getPullRequestDetail: jest.fn(async () => ({
    ...consolePullRequestDetailFixture,
    files: [],
    commits: [],
  })),
});

const createClient = (): ConsoleApiClient => ({
  fetchItemBody: jest.fn(),
  fetchComments: jest.fn(),
  fetchPullRequestFiles: jest.fn(),
  fetchPullRequestCommits: jest.fn(),
  fetchRelatedPullRequests: jest.fn(),
  fetchPullRequestDetail: jest.fn(),
  postReview: jest.fn(async () => undefined),
  postTriage: jest.fn(async () => undefined),
  postInTmux: jest.fn(async () => undefined),
});

describe('ConsoleItemDetailContainer', () => {
  it('loads the detail and dispatches a review through the client', async () => {
    const client = createClient();
    const onProcessed = jest.fn();
    const onAdvance = jest.fn();
    render(
      <ConsoleItemDetailContainer
        tab="prs"
        item={consoleListItemsFixture[0]}
        client={client}
        cache={createCache()}
        statusOptions={consoleStatusOptionsFixture}
        storyOptions={consoleStoryOptionsFixture}
        onProcessed={onProcessed}
        onAdvance={onAdvance}
      />,
    );
    await waitFor(() =>
      expect(screen.getByText('Approve')).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByText('Approve'));
    await waitFor(() =>
      expect(client.postReview).toHaveBeenCalledWith(
        {
          repo: consoleListItemsFixture[0].repo,
          number: consoleListItemsFixture[0].number,
        },
        'APPROVE',
      ),
    );
    expect(onAdvance).toHaveBeenCalled();
  });
});
