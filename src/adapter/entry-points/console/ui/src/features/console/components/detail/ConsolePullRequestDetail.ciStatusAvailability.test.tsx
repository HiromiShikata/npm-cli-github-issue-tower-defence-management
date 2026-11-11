import { render } from '@testing-library/react';
import type { ConsoleRelatedPullRequest } from '../../logic/types';
import {
  consoleChangedFilesFixture,
  consoleCommitsFixture,
  consoleRelatedPullRequestsFixture,
} from '../../testing/fixtures';
import { ConsolePullRequestDetail } from './ConsolePullRequestDetail';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

const now = Date.parse('2026-06-19T12:00:00.000Z');
const basePullRequest = consoleRelatedPullRequestsFixture[0];
const changedFileName = consoleChangedFilesFixture[0].path.split('/').at(-1);

const withCiStatus = (
  pullRequest: ConsoleRelatedPullRequest,
  ciStatus: {
    ciStatusAvailability: 'AVAILABLE' | 'UNAVAILABLE';
    isPassedAllCiJob: boolean;
    isCiStateSuccess: boolean;
  },
) => ({ ...pullRequest, ...ciStatus });

const renderPullRequest = (pullRequest: ConsoleRelatedPullRequest) =>
  render(
    <ConsolePullRequestDetail
      pullRequest={pullRequest}
      body={pullRequest.summary?.body ?? ''}
      bodyIsLoading={false}
      files={consoleChangedFilesFixture}
      filesAreLoading={false}
      filesError={null}
      commits={consoleCommitsFixture}
      commitsAreLoading={false}
      commitsError={null}
      now={now}
    />,
  );

describe('ConsolePullRequestDetail CI status availability', () => {
  it.each([
    {
      name: 'AVAILABLE with passing CI',
      ciStatusAvailability: 'AVAILABLE' as const,
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      shownLabel: 'CI passing',
      hiddenLabels: ['CI failing', 'CI unknown'],
    },
    {
      name: 'AVAILABLE with failing CI',
      ciStatusAvailability: 'AVAILABLE' as const,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      shownLabel: 'CI failing',
      hiddenLabels: ['CI passing', 'CI unknown'],
    },
    {
      name: 'UNAVAILABLE CI status',
      ciStatusAvailability: 'UNAVAILABLE' as const,
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      shownLabel: 'CI unknown',
      hiddenLabels: ['CI passing', 'CI failing'],
    },
  ])(
    'shows the "$shownLabel" label and hides the other CI labels for $name',
    ({ ciStatusAvailability, isPassedAllCiJob, isCiStateSuccess, shownLabel, hiddenLabels }) => {
      const pullRequest = withCiStatus(basePullRequest, {
        ciStatusAvailability,
        isPassedAllCiJob,
        isCiStateSuccess,
      });
      const { getByText, queryByText } = renderPullRequest(pullRequest);

      expect(getByText(shownLabel)).toBeInTheDocument();
      for (const hiddenLabel of hiddenLabels) {
        expect(queryByText(hiddenLabel)).toBeNull();
      }
    },
  );

  it.each([
    { name: 'AVAILABLE', ciStatusAvailability: 'AVAILABLE' as const },
    { name: 'UNAVAILABLE', ciStatusAvailability: 'UNAVAILABLE' as const },
  ])(
    'keeps the description, changed files and open link visible for a pull request whose CI status is $name',
    ({ ciStatusAvailability }) => {
      const pullRequest = withCiStatus(basePullRequest, {
        ciStatusAvailability,
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
      });
      const { getByText, getAllByText, getByRole } =
        renderPullRequest(pullRequest);

      expect(getByText('Description')).toBeInTheDocument();
      expect(
        getByText('Changed files', { exact: false }),
      ).toBeInTheDocument();
      expect(getAllByText(changedFileName ?? '').length).toBeGreaterThan(0);
      expect(getByRole('link', { name: 'open' })).toHaveAttribute(
        'href',
        pullRequest.url,
      );
    },
  );
});
