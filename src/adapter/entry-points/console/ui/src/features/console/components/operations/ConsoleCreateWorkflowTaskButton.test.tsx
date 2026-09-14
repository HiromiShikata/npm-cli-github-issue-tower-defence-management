import { fireEvent, render, waitFor } from '@testing-library/react';
import { ConsoleCreateWorkflowTaskButton } from './ConsoleCreateWorkflowTaskButton';

describe('ConsoleCreateWorkflowTaskButton', () => {
  it('clicking the ! button opens the dialog', () => {
    const { getByTitle } = render(
      <ConsoleCreateWorkflowTaskButton onCreateWorkflowTask={jest.fn()} />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('submitting the dialog with a title calls onCreateWorkflowTask and closes the dialog', async () => {
    const onCreateWorkflowTask = jest
      .fn()
      .mockResolvedValue('https://github.com/HiromiShikata/secretary/issues/1');
    const { getByTitle, getByRole } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    const textarea = document.body.querySelector(
      'textarea[aria-label="Title"]',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'My workflow task' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(document.body.querySelector('[role="dialog"]')).toBeNull(),
    );
    expect(onCreateWorkflowTask).toHaveBeenCalledWith('My workflow task');
  });

  it('cancelling the dialog closes it without calling onCreateWorkflowTask', () => {
    const onCreateWorkflowTask = jest.fn();
    const { getByTitle, getByRole } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    fireEvent.click(getByRole('button', { name: /^cancel$/i }));
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(onCreateWorkflowTask).not.toHaveBeenCalled();
  });

  it('error thrown by onCreateWorkflowTask is displayed in the dialog', async () => {
    const onCreateWorkflowTask = jest
      .fn()
      .mockRejectedValue(new Error('API error'));
    const { getByTitle, getByRole } = render(
      <ConsoleCreateWorkflowTaskButton
        onCreateWorkflowTask={onCreateWorkflowTask}
      />,
    );
    fireEvent.click(getByTitle('Create workflow improvement task'));
    const textarea = document.body.querySelector(
      'textarea[aria-label="Title"]',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Failing task' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(
        document.body.querySelector('[role="alert"]')?.textContent,
      ).toBe('API error'),
    );
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
