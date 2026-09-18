import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleItemTitleEditor } from './ConsoleItemTitleEditor';

describe('ConsoleItemTitleEditor', () => {
  it('shows the title text in display mode', () => {
    const { getByText } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    expect(getByText('My task title')).toBeInTheDocument();
  });

  it('has the console-detail-title-text class in display mode', () => {
    const { container } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    expect(
      container.querySelector('.console-detail-title-text'),
    ).not.toBeNull();
  });

  it('shows an edit button in display mode', () => {
    const { getByRole } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    expect(getByRole('button', { name: 'Edit title' })).toBeInTheDocument();
  });

  it('enters editing mode with input pre-filled when clicking the edit button', () => {
    const { getByRole } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    const input = getByRole('textbox', { name: 'Edit title' });
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('My task title');
  });

  it('has the console-detail-title-text class in editing mode', () => {
    const { getByRole, container } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    expect(
      container.querySelector('.console-detail-title-text'),
    ).not.toBeNull();
  });

  it('exits editing mode without calling onTitleRename when Cancel is clicked', () => {
    const onTitleRename = jest.fn();
    const { getByRole, queryByRole } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={onTitleRename} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.click(getByRole('button', { name: 'Cancel' }));
    expect(queryByRole('textbox')).toBeNull();
    expect(onTitleRename).not.toHaveBeenCalled();
  });

  it('exits editing mode when Escape is pressed', () => {
    const { getByRole, queryByRole } = render(
      <ConsoleItemTitleEditor title="My task title" onTitleRename={jest.fn()} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.keyDown(getByRole('textbox'), { key: 'Escape' });
    expect(queryByRole('textbox')).toBeNull();
  });

  it('calls onTitleRename with the trimmed new title and shows the new title after save', async () => {
    const onTitleRename = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole, getByText } = render(
      <ConsoleItemTitleEditor title="Old title" onTitleRename={onTitleRename} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.change(getByRole('textbox'), { target: { value: 'New title' } });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(queryByRole('textbox')).toBeNull());
    await act(async () => {});
    expect(onTitleRename).toHaveBeenCalledWith('New title');
    expect(getByText('New title')).toBeInTheDocument();
  });

  it('calls onTitleRename when Enter is pressed in the input', async () => {
    const onTitleRename = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole } = render(
      <ConsoleItemTitleEditor title="Old title" onTitleRename={onTitleRename} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    const input = getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New title' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(queryByRole('textbox')).toBeNull());
    expect(onTitleRename).toHaveBeenCalledWith('New title');
  });

  it('does not call onTitleRename and exits editing when the title is unchanged', async () => {
    const onTitleRename = jest.fn();
    const { getByRole, queryByRole } = render(
      <ConsoleItemTitleEditor title="Same title" onTitleRename={onTitleRename} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(queryByRole('textbox')).toBeNull());
    expect(onTitleRename).not.toHaveBeenCalled();
  });

  it('shows an error alert and stays in editing mode when onTitleRename throws', async () => {
    const onTitleRename = jest.fn().mockRejectedValue(new Error('GitHub API error'));
    const { getByRole, queryByRole } = render(
      <ConsoleItemTitleEditor title="Old title" onTitleRename={onTitleRename} />,
    );
    fireEvent.click(getByRole('button', { name: 'Edit title' }));
    fireEvent.change(getByRole('textbox'), { target: { value: 'New title' } });
    fireEvent.click(getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(queryByRole('alert')).not.toBeNull());
    expect(queryByRole('alert')).toHaveTextContent('GitHub API error');
    expect(queryByRole('textbox')).not.toBeNull();
  });
});
