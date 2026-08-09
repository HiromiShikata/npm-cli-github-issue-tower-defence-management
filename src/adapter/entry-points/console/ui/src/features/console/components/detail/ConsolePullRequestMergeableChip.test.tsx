import { render } from '@testing-library/react';
import { ConsolePullRequestMergeableChip } from './ConsolePullRequestMergeableChip';

describe('ConsolePullRequestMergeableChip', () => {
  it('renders the green no-conflict chip when the pull request is mergeable', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestMergeableChip mergeableStatus="MERGEABLE" />,
    );
    expect(getByText('No conflict')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('Checking merge status')).toBeNull();
  });

  it('renders the red conflict chip when the pull request is conflicting', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestMergeableChip mergeableStatus="CONFLICTING" />,
    );
    expect(getByText('Conflict')).toBeInTheDocument();
    expect(queryByText('No conflict')).toBeNull();
  });

  it('renders the gray checking chip when the merge status is unknown', () => {
    const { getByText, queryByText } = render(
      <ConsolePullRequestMergeableChip mergeableStatus="UNKNOWN" />,
    );
    expect(getByText('Checking merge status')).toBeInTheDocument();
    expect(queryByText('Conflict')).toBeNull();
    expect(queryByText('No conflict')).toBeNull();
  });
});
