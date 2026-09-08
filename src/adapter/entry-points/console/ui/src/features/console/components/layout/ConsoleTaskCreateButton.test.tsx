import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleStoryEntry } from '../../logic/types';
import {
  ConsoleTaskCreateButton,
  type ConsoleTaskCreateButtonProps,
} from './ConsoleTaskCreateButton';

const storyEntries: ConsoleStoryEntry[] = [
  {
    storyName: 'regular / workflow improvement',
    storyOptionId: 'opt-workflow-improvement',
    color: 'BLUE',
    openItemCount: 3,
    storyViewUrl: null,
    items: [],
  },
  {
    storyName: 'regular / tdpm dashboard & console improvement',
    storyOptionId: 'opt-tdpm-console',
    color: 'GREEN',
    openItemCount: 5,
    storyViewUrl: null,
    items: [],
  },
];

const baseProps: ConsoleTaskCreateButtonProps = {
  pjcode: 'umino',
  storyEntries,
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

  it('opens the form when the New task button is clicked', () => {
    const { getByRole, queryByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} />,
    );
    expect(queryByRole('combobox', { name: /story/i })).toBeNull();
    fireEvent.click(getByRole('button', { name: /new task/i }));
    expect(getByRole('combobox', { name: /story/i })).not.toBeNull();
    expect(getByRole('textbox', { name: /issue title/i })).not.toBeNull();
    expect(getByRole('button', { name: /^create$/i })).not.toBeNull();
    expect(getByRole('button', { name: /^cancel$/i })).not.toBeNull();
  });

  it('populates the story select with all story options', () => {
    const { getByRole } = render(<ConsoleTaskCreateButton {...baseProps} />);
    fireEvent.click(getByRole('button', { name: /new task/i }));
    const select = getByRole('combobox', {
      name: /story/i,
    }) as HTMLSelectElement;
    expect(select.options.length).toBe(2);
    expect(select.options[0].text).toBe('regular / workflow improvement');
    expect(select.options[1].text).toBe(
      'regular / tdpm dashboard & console improvement',
    );
  });

  it('calls onCreateIssue with first story id and entered title on submit', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    const titleInput = getByRole('textbox', { name: /issue title/i });
    fireEvent.change(titleInput, { target: { value: 'Fix the bug' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onCreateIssue).toHaveBeenCalledWith(
        'opt-workflow-improvement',
        'Fix the bug',
      ),
    );
  });

  it('calls onCreateIssue with selected story id when a different story is chosen', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    const select = getByRole('combobox', { name: /story/i });
    fireEvent.change(select, { target: { value: 'opt-tdpm-console' } });
    const titleInput = getByRole('textbox', { name: /issue title/i });
    fireEvent.change(titleInput, { target: { value: 'New console feature' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onCreateIssue).toHaveBeenCalledWith(
        'opt-tdpm-console',
        'New console feature',
      ),
    );
  });

  it('closes the form after successful submission', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /issue title/i }), {
      target: { value: 'Done task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(queryByRole('combobox', { name: /story/i })).toBeNull(),
    );
    expect(getByRole('button', { name: /new task/i })).not.toBeNull();
  });

  it('shows an error message when onCreateIssue rejects', async () => {
    const onCreateIssue = jest
      .fn()
      .mockRejectedValue(new Error('Network error'));
    const { getByRole, getByText } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /issue title/i }), {
      target: { value: 'Task with error' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(getByText('Network error')).not.toBeNull());
  });

  it('shows an error when title is empty on submit', async () => {
    const onCreateIssue = jest.fn();
    const { getByRole, getByText } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(getByText(/title is required/i)).not.toBeNull());
    expect(onCreateIssue).not.toHaveBeenCalled();
  });

  it('canceling the form hides it and does not call onCreateIssue', () => {
    const onCreateIssue = jest.fn();
    const { getByRole, queryByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /issue title/i }), {
      target: { value: 'Some title' },
    });
    fireEvent.click(getByRole('button', { name: /^cancel$/i }));
    expect(queryByRole('combobox', { name: /story/i })).toBeNull();
    expect(getByRole('button', { name: /new task/i })).not.toBeNull();
    expect(onCreateIssue).not.toHaveBeenCalled();
  });

  it('resets the title input after successful submission when opened again', async () => {
    const onCreateIssue = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <ConsoleTaskCreateButton {...baseProps} onCreateIssue={onCreateIssue} />,
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    fireEvent.change(getByRole('textbox', { name: /issue title/i }), {
      target: { value: 'First task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(getByRole('button', { name: /new task/i })).not.toBeNull(),
    );
    fireEvent.click(getByRole('button', { name: /new task/i }));
    const titleInput = getByRole('textbox', {
      name: /issue title/i,
    }) as HTMLInputElement;
    expect(titleInput.value).toBe('');
  });
});
