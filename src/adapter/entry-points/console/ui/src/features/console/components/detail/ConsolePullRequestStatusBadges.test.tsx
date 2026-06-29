import { render } from '@testing-library/react';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

describe('ConsolePullRequestStatusBadges', () => {
  it('renders a passing CI badge when all CI jobs passed and the CI state is success', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="MERGEABLE"
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('CI passing')).toBeInTheDocument();
    expect(queryByText('Out of date')).toBeNull();
  });

  it('renders a failing CI badge with missing required checks', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="MERGEABLE"
        isPassedAllCiJob={false}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={['build', 'test']}
      />,
    );
    expect(getByText('CI failing')).toBeInTheDocument();
    expect(getByText(/missing: build, test/)).toBeInTheDocument();
  });

  it('renders the green no-conflict badge when the pull request is mergeable', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="MERGEABLE"
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('No conflict')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('Checking merge status')).toBeNull();
  });

  it('renders the red conflict badge when the pull request is conflicting', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="CONFLICTING"
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('Conflict')).toBeInTheDocument();
    expect(queryByText('No conflict')).toBeNull();
  });

  it('renders the gray checking badge when the merge status is unknown', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="UNKNOWN"
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('Checking merge status')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('No conflict')).toBeNull();
  });

  it('renders the out-of-date badge when the branch is behind the base branch', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="MERGEABLE"
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={true}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('Out of date')).toBeInTheDocument();
  });

  it('treats a successful CI state but unfinished jobs as failing', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        mergeableStatus="MERGEABLE"
        isPassedAllCiJob={false}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('CI failing')).toBeInTheDocument();
  });
});
