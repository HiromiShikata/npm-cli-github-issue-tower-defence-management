import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleTaskCreateButton,
  type ConsoleTaskCreateButtonProps,
  type IssueCreateParams,
} from './ConsoleTaskCreateButton';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'regular / workflow improvement',
    storyOptionId: 'opt-workflow-improvement',
    color: 'BLUE',
    description: '',
    openItemCount: 3,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / tdpm dashboard & console improvement',
    storyOptionId: 'opt-tdpm-console',
    color: 'GREEN',
    description: '',
    openItemCount: 5,
    storyViewUrl: null,
    items: [],
  },
];

const agentOptions: ConsoleFieldOption[] = [
  { id: 'agent-developer', name: 'developer', color: 'BLUE' },
];

const baseProps: ConsoleTaskCreateButtonProps = {
  pjcode: 'umino',
  storyEntries,
  agentOptions,
  defaultNameWithOwner:
    'HiromiShikata/npm-cli-github-issue-tower-defence-management',
  onCreateIssue: jest.fn(),
};

describe('ConsoleTaskCreateButton', () => {
  it('renders the New task button when storyEntries and defaultNameWithOwner are present', () => {
    const { getByRole } = render(<ConsoleTaskCreateButton {...baseProps} />);
    const btn = getByRole('button', { name: /new task/i });
    expect(btn).not.toBeNull();
    expect(btn).not.toBeDisabled();
  });

  it('is disabled when defaultNameWithOwner is null', () => {
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} defaultNameWithOwner={null} />,
    );
    expect(getByRole('button', { name: /new task/i })).toBeDisabled();
  });

  it('is disabled when storyEntries is empty', () => {
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} storyEntries={[]} />,
    );
    expect(getByRole('button', { name: /new task/i })).toBeDisabled();
  });

  it('opens the dialog when the New task button is clicked', () => {
    const { getByRole } = render(<ConsoleTaskCreateButton {...baseProps} />);
    fireEvent.click(getByRole('button', { name: /new task/i }));
    expect(getByRole('dialog', { name: /create new task/i })).not.toBeNull();
  });

  it('closes the dialog when Cancel is clicked', () => {
    const { getByRole, queryByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    expect(getByRole('dialog', { name: /create new task/i })).not.toBeNull();
    fireEvent.click(getByRole('button', { name: /^cancel$/i }));
    expect(queryByRole('dialog', { name: /create new task/i })).toBeNull();
  });

  it('calls onCreateIssue with correct IssueCreateParams when form is submitted', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Fix the bug' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onCreateIssue).toHaveBeenCalledWith<[IssueCreateParams]>({
        storyName: 'regular / workflow improvement',
        agentOptionId: null,
        title: 'Fix the bug',
        body: null,
        files: [],
      }),
    );
  });

  it('closes the dialog after successful submission', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Done task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(queryByRole('dialog', { name: /create new task/i })).toBeNull(),
    );
    expect(getByRole('button', { name: /new task/i })).not.toBeNull();
  });
});
