import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCreateWorkflowTaskButton } from './ConsoleCreateWorkflowTaskButton';

describe('ConsoleCreateWorkflowTaskButton', () => {
  it('renders only the toggle button initially', () => {
    const { getByTitle, queryByPlaceholderText } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    expect(getByTitle('Create workflow improvement task')).toBeInTheDocument();
    expect(queryByPlaceholderText('Task title')).toBeNull();
  });

  it('shows the form when the toggle button is clicked', () => {
    const { getByTitle, getByPlaceholderText, getByText } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    expect(getByPlaceholderText('Task title')).toBeInTheDocument();
    expect(getByText('Create')).toBeInTheDocument();
  });

  it('collapses back when the toggle button is clicked a second time', () => {
    const { getByTitle, queryByPlaceholderText } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    fireEvent.click(getByTitle('Create workflow improvement task'));
    expect(queryByPlaceholderText('Task title')).toBeNull();
  });

  it('keeps the create button disabled when the title is empty', () => {
    const { getByTitle, getByText } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    expect(getByText('Create')).toBeDisabled();
  });

  it('enables the create button when a title is entered', () => {
    const { getByTitle, getByPlaceholderText, getByText } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    fireEvent.change(getByPlaceholderText('Task title'), {
      target: { value: 'Fix the pipeline' },
    });
    expect(getByText('Create')).not.toBeDisabled();
  });

  it('calls onCreateWorkflowTask with the trimmed title and collapses on success', async () => {
    const onCreateWorkflowTask = jest
      .fn()
      .mockResolvedValue('https://github.com/HiromiShikata/secretary/issues/1');
    const {
      getByTitle,
      getByPlaceholderText,
      getByText,
      queryByPlaceholderText,
    } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    fireEvent.change(getByPlaceholderText('Task title'), {
      target: { value: '  Fix the pipeline  ' },
    });
    fireEvent.click(getByText('Create'));
    await waitFor(() =>
      expect(queryByPlaceholderText('Task title')).toBeNull(),
    );
    expect(onCreateWorkflowTask).toHaveBeenCalledWith('Fix the pipeline');
  });

  it('shows an error message and stays expanded when the call fails', async () => {
    const onCreateWorkflowTask = jest
      .fn()
      .mockRejectedValue(new Error('API error'));
    const { getByTitle, getByPlaceholderText, getByText } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    fireEvent.change(getByPlaceholderText('Task title'), {
      target: { value: 'Fix the pipeline' },
    });
    fireEvent.click(getByText('Create'));
    await waitFor(() => expect(getByText('API error')).toBeInTheDocument());
    expect(getByPlaceholderText('Task title')).toBeInTheDocument();
  });

  it('submits when Enter key is pressed in the title input', async () => {
    const onCreateWorkflowTask = jest
      .fn()
      .mockResolvedValue('https://github.com/HiromiShikata/secretary/issues/1');
    const { getByTitle, getByPlaceholderText, queryByPlaceholderText } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    const input = getByPlaceholderText('Task title');
    fireEvent.change(input, { target: { value: 'Fix the pipeline' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(queryByPlaceholderText('Task title')).toBeNull(),
    );
    expect(onCreateWorkflowTask).toHaveBeenCalledWith('Fix the pipeline');
  });
});
