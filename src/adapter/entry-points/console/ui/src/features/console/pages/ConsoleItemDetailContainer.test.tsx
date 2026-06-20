import { fireEvent, render, waitFor } from '@testing-library/react';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
  consoleStoryOptionsFixture,
} from '../fixtures';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { ResourceCache } from '../lib/resourceCache';
import { ConsoleItemDetailContainer } from './ConsoleItemDetailContainer';

jest.mock('../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const prItem = consoleListItemsFixture[0];

const buildCaches = (): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => '# body',
    fetchComments: async () => [],
    fetchPrFiles: async () => [],
    fetchPrCommits: async () => [],
    fetchRelatedPrs: async () => [],
    fetchIssueState: async () => ({
      state: 'open',
      merged: false,
      isPullRequest: true,
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
  };
};

const buildOperations = (): ConsoleOperationsApi => ({
  reviewPullRequest: jest.fn(async () => {}),
  setNextActionDate: jest.fn(async () => {}),
  setStory: jest.fn(async () => {}),
  setStatus: jest.fn(async () => {}),
  setInTmuxByHuman: jest.fn(async () => {}),
  closeIssue: jest.fn(async () => {}),
});

describe('ConsoleItemDetailContainer', () => {
  it('wires the review action to the operations api for a PR item', async () => {
    const operations = buildOperations();
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
      />,
    );
    await waitFor(() => {
      expect(getByText('Approve')).toBeInTheDocument();
    });
    fireEvent.click(getByText('Approve'));
    expect(operations.reviewPullRequest).toHaveBeenCalledWith(
      prItem,
      prItem.url,
      'approve',
    );
  });
});
