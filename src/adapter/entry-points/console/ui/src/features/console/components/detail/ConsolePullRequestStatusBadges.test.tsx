import { render } from '@testing-library/react';
import { ConsolePullRequestStatusBadges } from './ConsolePullRequestStatusBadges';

describe('ConsolePullRequestStatusBadges', () => {
  it('renders a passing CI badge when all CI jobs passed and the CI state is success', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestStatusBadges
        isConflicted={false}
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('CI passing')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('Out of date')).toBeNull();
  });

  it('renders a failing CI badge with missing required checks', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        isConflicted={false}
        isPassedAllCiJob={false}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={['build', 'test']}
      />,
    );
    expect(getByText('CI failing')).toBeInTheDocument();
    expect(getByText(/missing: build, test/)).toBeInTheDocument();
  });

  it('renders the conflict badge when the pull request is conflicted', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        isConflicted={true}
        isPassedAllCiJob={true}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('Conflict')).toBeInTheDocument();
  });

  it('renders the out-of-date badge when the branch is behind the base branch', () => {
    const { getByText } = render(
      <ConsolePullRequestStatusBadges
        isConflicted={false}
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
        isConflicted={false}
        isPassedAllCiJob={false}
        isCiStateSuccess={true}
        isBranchOutOfDate={false}
        missingRequiredCheckNames={[]}
      />,
    );
    expect(getByText('CI failing')).toBeInTheDocument();
  });
});
