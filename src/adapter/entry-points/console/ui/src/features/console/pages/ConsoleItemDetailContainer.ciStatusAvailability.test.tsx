import { render, waitFor } from '@testing-library/react';
import { mock } from 'jest-mock-extended';
import type { ConsoleCaches } from '../hooks/useConsoleCaches';
import type { ConsoleOperationsApi } from '../hooks/useConsoleOperations';
import { ResourceCache } from '../lib/resourceCache';
import type { ConsoleRelatedPullRequest } from '../logic/types';
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

const issueItem = consoleListItemsFixture[2];
const relatedPullRequestFixture = consoleRelatedPullRequestsFixture[0];
const changedFileName = consoleChangedFilesFixture[0].path.split('/').at(-1);

const withCiStatusAvailability = (
  pullRequest: ConsoleRelatedPullRequest,
  ciStatusAvailability: 'AVAILABLE' | 'UNAVAILABLE',
) => ({ ...pullRequest, ciStatusAvailability });

const buildCaches = (relatedPrs: ConsoleRelatedPullRequest[]): ConsoleCaches => {
  const client = {
    fetchItemBody: async () => '# body',
    fetchComments: async () => [],
    fetchPrFiles: async () => consoleChangedFilesFixture,
    fetchPrCommits: async () => [],
    fetchRelatedPrs: async () => relatedPrs,
    fetchIssueState: async () => ({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Container fixture title',
      stateReason: '',
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

describe('ConsoleItemDetailContainer related pull request CI status availability', () => {
  it.each([
    { name: 'AVAILABLE', ciStatusAvailability: 'AVAILABLE' as const },
    { name: 'UNAVAILABLE', ciStatusAvailability: 'UNAVAILABLE' as const },
  ])(
    'keeps the review controls and the changed files of a related pull request whose CI status is $name',
    async ({ ciStatusAvailability }) => {
      const relatedPullRequest = withCiStatusAvailability(
        relatedPullRequestFixture,
        ciStatusAvailability,
      );
      const { getByText, findAllByText } = render(
        <ConsoleItemDetailContainer
          tab="todo-by-human"
          item={{
            ...issueItem,
            relatedOpenPullRequestUrls: [relatedPullRequest.url],
          }}
          caches={buildCaches([relatedPullRequest])}
          operations={mock<ConsoleOperationsApi>()}
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
        expect(getByText('Reject')).toBeInTheDocument();
      });
      expect(getByText('Approve & Merge')).toBeInTheDocument();
      expect(getByText('Unnecessary')).toBeInTheDocument();
      expect(getByText('Totally wrong')).toBeInTheDocument();
      expect(
        (await findAllByText(changedFileName ?? '')).length,
      ).toBeGreaterThan(0);
    },
  );
});
