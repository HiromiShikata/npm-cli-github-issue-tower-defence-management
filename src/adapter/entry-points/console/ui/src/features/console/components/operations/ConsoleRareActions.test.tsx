import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleRareActionsProps } from './ConsoleRareActions';
import { ConsoleRareActions } from './ConsoleRareActions';

const ISSUE_URL_A = 'https://github.com/owner/repo/issues/1';
const ISSUE_URL_B = 'https://github.com/owner/repo/issues/2';
const PULL_REQUEST_URL_C = 'https://github.com/owner/repo/pull/3';

const renderRareActions = (overrides: Partial<ConsoleRareActionsProps> = {}) =>
  render(
    <ConsoleRareActions
      dependedIssueUrls={[]}
      onReplaceDependedIssueUrls={async () => {}}
      {...overrides}
    />,
  );

describe('ConsoleRareActions', () => {
  it('renders only the toggle button in the collapsed state', () => {
    const { getByTitle, queryByPlaceholderText } = renderRareActions();
    expect(getByTitle('Rare actions')).toBeInTheDocument();
    expect(queryByPlaceholderText('Depended issue URL')).toBeNull();
  });

  it('reveals a multi-line textarea and the Set Depended Issue button after the toggle is clicked', () => {
    const { getByTitle, getByPlaceholderText, getByText } = renderRareActions();
    fireEvent.click(getByTitle('Rare actions'));
    expect(getByPlaceholderText('Depended issue URL').tagName).toBe('TEXTAREA');
    expect(getByText('Set Depended Issue')).toBeInTheDocument();
  });

  it('collapses back when the toggle is clicked a second time', () => {
    const { getByTitle, queryByPlaceholderText } = renderRareActions();
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.click(getByTitle('Rare actions'));
    expect(queryByPlaceholderText('Depended issue URL')).toBeNull();
  });

  it.each([
    {
      name: 'no current URLs leaves the field empty',
      dependedIssueUrls: [],
      expected: '',
    },
    {
      name: 'one current URL fills the field with that URL',
      dependedIssueUrls: [ISSUE_URL_A],
      expected: ISSUE_URL_A,
    },
    {
      name: 'several current URLs fill the field one per line in order',
      dependedIssueUrls: [ISSUE_URL_A, PULL_REQUEST_URL_C, ISSUE_URL_B],
      expected: `${ISSUE_URL_A}\n${PULL_REQUEST_URL_C}\n${ISSUE_URL_B}`,
    },
  ])('$name', ({ dependedIssueUrls, expected }) => {
    const { getByTitle, getByPlaceholderText } = renderRareActions({
      dependedIssueUrls,
    });
    fireEvent.click(getByTitle('Rare actions'));
    expect(getByPlaceholderText('Depended issue URL')).toHaveValue(expected);
  });

  it('shows the current URLs again when the panel is reopened after an unsaved edit', () => {
    const { getByTitle, getByPlaceholderText } = renderRareActions({
      dependedIssueUrls: [ISSUE_URL_A],
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.change(getByPlaceholderText('Depended issue URL'), {
      target: { value: 'unsaved text' },
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.click(getByTitle('Rare actions'));
    expect(getByPlaceholderText('Depended issue URL')).toHaveValue(ISSUE_URL_A);
  });

  it('keeps Set Depended Issue enabled when the field is empty', () => {
    const { getByTitle, getByText } = renderRareActions();
    fireEvent.click(getByTitle('Rare actions'));
    expect(getByText('Set Depended Issue')).not.toBeDisabled();
  });

  it.each([
    {
      name: 'deleting one line passes the remaining URLs only',
      dependedIssueUrls: [ISSUE_URL_A, ISSUE_URL_B],
      typedText: ISSUE_URL_A,
      expected: [ISSUE_URL_A],
    },
    {
      name: 'clearing the whole field passes an empty list',
      dependedIssueUrls: [ISSUE_URL_A, ISSUE_URL_B],
      typedText: '',
      expected: [],
    },
    {
      name: 'adding a new line passes the existing URLs plus the added one',
      dependedIssueUrls: [ISSUE_URL_A],
      typedText: `${ISSUE_URL_A}\n${ISSUE_URL_B}`,
      expected: [ISSUE_URL_A, ISSUE_URL_B],
    },
    {
      name: 'comma and newline separators are both parsed into separate URLs',
      dependedIssueUrls: [],
      typedText: `${ISSUE_URL_A}, ${ISSUE_URL_B}\n${PULL_REQUEST_URL_C}`,
      expected: [ISSUE_URL_A, ISSUE_URL_B, PULL_REQUEST_URL_C],
    },
  ])('$name', async ({ dependedIssueUrls, typedText, expected }) => {
    const onReplaceDependedIssueUrls = jest.fn().mockResolvedValue(undefined);
    const { getByTitle, getByPlaceholderText, getByText } = renderRareActions({
      dependedIssueUrls,
      onReplaceDependedIssueUrls,
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.change(getByPlaceholderText('Depended issue URL'), {
      target: { value: typedText },
    });
    fireEvent.click(getByText('Set Depended Issue'));
    await waitFor(() =>
      expect(onReplaceDependedIssueUrls).toHaveBeenCalledWith(expected),
    );
    expect(onReplaceDependedIssueUrls).toHaveBeenCalledTimes(1);
  });

  it('collapses the panel after a resolved save', async () => {
    const {
      getByTitle,
      getByPlaceholderText,
      getByText,
      queryByPlaceholderText,
    } = renderRareActions({
      onReplaceDependedIssueUrls: jest.fn().mockResolvedValue(undefined),
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.change(getByPlaceholderText('Depended issue URL'), {
      target: { value: ISSUE_URL_A },
    });
    fireEvent.click(getByText('Set Depended Issue'));
    await waitFor(() =>
      expect(queryByPlaceholderText('Depended issue URL')).toBeNull(),
    );
  });

  it('disables Set Depended Issue while the save is in flight', async () => {
    const { getByTitle, getByPlaceholderText, getByText } = renderRareActions({
      onReplaceDependedIssueUrls: jest.fn(() => new Promise<void>(() => {})),
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.change(getByPlaceholderText('Depended issue URL'), {
      target: { value: ISSUE_URL_A },
    });
    fireEvent.click(getByText('Set Depended Issue'));
    await waitFor(() => expect(getByText('...')).toBeDisabled());
  });

  it('shows the error message and keeps the typed text when the save is rejected', async () => {
    const typedText = `${ISSUE_URL_A}\n${ISSUE_URL_B}`;
    const { getByTitle, getByPlaceholderText, getByText } = renderRareActions({
      onReplaceDependedIssueUrls: jest
        .fn()
        .mockRejectedValue(new Error('network error')),
    });
    fireEvent.click(getByTitle('Rare actions'));
    fireEvent.change(getByPlaceholderText('Depended issue URL'), {
      target: { value: typedText },
    });
    fireEvent.click(getByText('Set Depended Issue'));
    await waitFor(() => expect(getByText('network error')).toBeInTheDocument());
    expect(getByPlaceholderText('Depended issue URL')).toHaveValue(typedText);
  });

  it('does not show the input or button when onReplaceDependedIssueUrls is null', () => {
    const { getByTitle, queryByPlaceholderText, queryByText } =
      renderRareActions({ onReplaceDependedIssueUrls: null });
    fireEvent.click(getByTitle('Rare actions'));
    expect(queryByPlaceholderText('Depended issue URL')).toBeNull();
    expect(queryByText('Set Depended Issue')).toBeNull();
  });
});
