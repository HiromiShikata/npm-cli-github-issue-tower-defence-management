import { fireEvent, render, waitFor, within } from '@testing-library/react';
import type { ConsoleStoryRowField } from '../../logic/consoleStoryRowFields';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
  ConsoleStoryEntry,
} from '../../logic/types';
import {
  ConsoleStoryList,
  type ConsoleStoryListProps,
  type ConsoleStoryTaskActions,
} from './ConsoleStoryList';
import { ConsoleStoryRowFieldToggles } from './ConsoleStoryRowFieldToggles';

const item: ConsoleListItem = {
  number: 8001,
  title: 'Row control task',
  url: 'https://github.com/demo/repo/issues/8001',
  repo: 'demo/repo',
  nameWithOwner: 'demo/repo',
  projectItemId: 'item-8001',
  itemId: 'item-8001',
  isPr: false,
  story: 'Row story',
  status: 'Todo by human',
  agent: 'developer',
  nextActionDate: '2026-07-10T00:00:00.000Z',
  nextActionHour: 9,
  dependedIssueUrls: ['https://github.com/demo/repo/issues/5'],
  labels: [],
  createdAt: '2026-06-13T08:18:45.000Z',
  relatedOpenPullRequestUrls: [],
};

const stories: ConsoleStoryEntry[] = [
  {
    storyName: 'Row story',
    storyOptionId: 'row-story',
    color: 'BLUE',
    description: '',
    openItemCount: 1,
    storyViewUrl: null,
    items: [item],
  },
];

const agentOptions: ConsoleFieldOption[] = [
  { id: 'agent-developer', name: 'developer', color: 'BLUE' },
  { id: 'agent-chore', name: 'chore', color: 'GRAY' },
];

const statusFieldOptions: ConsoleFieldOption[] = [
  { id: 'status-todo', name: 'Todo by human', color: 'GRAY' },
  { id: 'status-owner', name: 'Awaiting Owner', color: 'GRAY' },
];

const buildTaskActions = (
  overrides: Partial<ConsoleStoryTaskActions> = {},
): ConsoleStoryTaskActions => ({
  onSetStory: () => Promise.resolve(),
  onSetAgent: () => Promise.resolve(),
  onSetStatus: () => Promise.resolve(),
  onSetDependedIssueUrl: () => Promise.resolve(),
  onSetNextActionDate: () => Promise.resolve(),
  onSetNextActionHour: () => Promise.resolve(),
  ...overrides,
});

const renderRowList = (overrides: Partial<ConsoleStoryListProps> = {}) => {
  const props: ConsoleStoryListProps = {
    stories,
    isLoading: false,
    error: null,
    showArchived: false,
    showDone: false,
    onCreateIssue: () => Promise.resolve(),
    onAddStory: () => Promise.resolve(),
    onSelectColor: () => undefined,
    onToggleArchived: () => undefined,
    onToggleDone: () => undefined,
    onReorderStory: () => Promise.resolve(),
    onDeleteStory: () => Promise.resolve(),
    onRenameStory: () => Promise.resolve(),
    onUpdateDescription: () => Promise.resolve(),
    optimisticColors: {},
    colorChangeInFlight: null,
    colorErrors: {},
    onOpenItem: () => undefined,
    agentOptions,
    statusFieldOptions,
    hiddenRowFields: [],
    onToggleRowField: () => undefined,
    taskActions: buildTaskActions(),
    ...overrides,
  };
  const rendered = render(<ConsoleStoryList {...props} />);
  fireEvent.click(rendered.getByRole('button', { name: 'Show tasks' }));
  return rendered;
};

describe('ConsoleStoryList task row controls', () => {
  it.each([
    {
      name: 'trigger fields',
      field: 'trigger' as const,
      label: 'Set next action date',
    },
    { name: 'agent', field: 'agent' as const, label: 'Set agent' },
    { name: 'story', field: 'story' as const, label: 'Set story' },
    { name: 'status', field: 'status' as const, label: 'Set status' },
  ])(
    'hides the $name controls on every row when that field is hidden',
    ({ field, label }) => {
      const { queryByLabelText } = renderRowList({
        hiddenRowFields: [field] as ConsoleStoryRowField[],
      });
      expect(queryByLabelText(label)).toBeNull();
    },
  );

  it('shows the title as the first element of each row and keeps the controls after it', () => {
    const { container } = renderRowList();
    const row = container.querySelector('.console-story-task-row');
    expect(row?.firstElementChild).toHaveClass('console-story-task-title');
    expect(row?.querySelector('.console-story-task-ops')).not.toBeNull();
  });

  it('sends the chosen status for the row task', async () => {
    const onSetStatus = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetStatus }),
    });
    fireEvent.change(getByLabelText('Set status'), {
      target: { value: 'status-owner' },
    });
    await waitFor(() => expect(onSetStatus).toHaveBeenCalledTimes(1));
    expect(onSetStatus).toHaveBeenCalledWith(item, statusFieldOptions[1]);
  });

  it('sends the chosen agent for the row task', async () => {
    const onSetAgent = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetAgent }),
    });
    fireEvent.change(getByLabelText('Set agent'), {
      target: { value: 'agent-chore' },
    });
    await waitFor(() => expect(onSetAgent).toHaveBeenCalledTimes(1));
    expect(onSetAgent).toHaveBeenCalledWith(item, agentOptions[1]);
  });

  it('sends the chosen next action date for the row task', async () => {
    const onSetNextActionDate = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetNextActionDate }),
    });
    fireEvent.change(getByLabelText('Set next action date'), {
      target: { value: '2026-08-01' },
    });
    await waitFor(() => expect(onSetNextActionDate).toHaveBeenCalledTimes(1));
    expect(onSetNextActionDate).toHaveBeenCalledWith(item, '2026-08-01');
  });

  it('shows the error in the row when a change fails', async () => {
    const { getByLabelText, findByRole, container } = renderRowList({
      taskActions: buildTaskActions({
        onSetStatus: () => Promise.reject(new Error('Status update rejected')),
      }),
    });
    fireEvent.change(getByLabelText('Set status'), {
      target: { value: 'status-owner' },
    });
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('Status update rejected');
    expect(alert).toHaveClass('console-story-task-error');
    expect(
      within(
        container.querySelector('.console-story-task-row') as HTMLElement,
      ).getByRole('alert'),
    ).toBe(alert);
  });

  it('sends the typed depended issue URL when the field loses focus', async () => {
    const onSetDependedIssueUrl = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetDependedIssueUrl }),
    });
    const input = getByLabelText('Set depended issue URL');
    fireEvent.change(input, {
      target: { value: 'https://github.com/demo/repo/issues/9' },
    });
    fireEvent.blur(input);
    await waitFor(() => expect(onSetDependedIssueUrl).toHaveBeenCalledTimes(1));
    expect(onSetDependedIssueUrl).toHaveBeenCalledWith(
      item,
      'https://github.com/demo/repo/issues/9',
    );
  });

  it('overwrites the depended issue URL with the new text instead of appending', async () => {
    const onSetDependedIssueUrl = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetDependedIssueUrl }),
    });
    const input = getByLabelText('Set depended issue URL');
    fireEvent.change(input, {
      target: { value: 'https://github.com/demo/repo/issues/7' },
    });
    fireEvent.blur(input);
    await waitFor(() => expect(onSetDependedIssueUrl).toHaveBeenCalledTimes(1));
    expect(onSetDependedIssueUrl).toHaveBeenCalledWith(
      item,
      'https://github.com/demo/repo/issues/7',
    );
  });

  it('clears the depended issue URL when the field is emptied and loses focus', async () => {
    const onSetDependedIssueUrl = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetDependedIssueUrl }),
    });
    const input = getByLabelText('Set depended issue URL');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    await waitFor(() => expect(onSetDependedIssueUrl).toHaveBeenCalledTimes(1));
    expect(onSetDependedIssueUrl).toHaveBeenCalledWith(item, '');
  });

  it('does not send the depended issue URL when the text is unchanged on blur', () => {
    const onSetDependedIssueUrl = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetDependedIssueUrl }),
    });
    fireEvent.blur(getByLabelText('Set depended issue URL'));
    expect(onSetDependedIssueUrl).not.toHaveBeenCalled();
  });

  it('shows the error and restores the stored depended issue URL when the save is rejected', async () => {
    const { getByLabelText, findByRole, container } = renderRowList({
      taskActions: buildTaskActions({
        onSetDependedIssueUrl: () =>
          Promise.reject(new Error('Depended URL rejected')),
      }),
    });
    const input = getByLabelText('Set depended issue URL');
    fireEvent.change(input, { target: { value: 'not-a-url' } });
    fireEvent.blur(input);
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('Depended URL rejected');
    expect(
      within(
        container.querySelector('.console-story-task-row') as HTMLElement,
      ).getByLabelText('Set depended issue URL'),
    ).toHaveValue('https://github.com/demo/repo/issues/5');
  });

  it('sends the chosen next action hour for the row task', async () => {
    const onSetNextActionHour = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetNextActionHour }),
    });
    fireEvent.change(getByLabelText('Set next action hour'), {
      target: { value: '10' },
    });
    await waitFor(() => expect(onSetNextActionHour).toHaveBeenCalledTimes(1));
    expect(onSetNextActionHour).toHaveBeenCalledWith(item, 10);
  });

  it('clears the next action hour by sending null when the empty option is chosen', async () => {
    const onSetNextActionHour = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetNextActionHour }),
    });
    fireEvent.change(getByLabelText('Set next action hour'), {
      target: { value: '' },
    });
    await waitFor(() => expect(onSetNextActionHour).toHaveBeenCalledTimes(1));
    expect(onSetNextActionHour).toHaveBeenCalledWith(item, null);
  });

  it('clears the next action date when the date input is emptied', async () => {
    const onSetNextActionDate = jest.fn(() => Promise.resolve());
    const { getByLabelText } = renderRowList({
      taskActions: buildTaskActions({ onSetNextActionDate }),
    });
    fireEvent.change(getByLabelText('Set next action date'), {
      target: { value: '' },
    });
    await waitFor(() => expect(onSetNextActionDate).toHaveBeenCalledTimes(1));
    expect(onSetNextActionDate).toHaveBeenCalledWith(item, '');
  });

  it('shows the error and restores the stored hour when the hour change is rejected', async () => {
    const { getByLabelText, findByRole, container } = renderRowList({
      taskActions: buildTaskActions({
        onSetNextActionHour: () =>
          Promise.reject(new Error('Hour update rejected')),
      }),
    });
    fireEvent.change(getByLabelText('Set next action hour'), {
      target: { value: '15' },
    });
    const alert = await findByRole('alert');
    expect(alert).toHaveTextContent('Hour update rejected');
    expect(
      within(
        container.querySelector('.console-story-task-row') as HTMLElement,
      ).getByLabelText('Set next action hour'),
    ).toHaveValue('9');
  });
});

describe('ConsoleStoryRowFieldToggles', () => {
  it.each([
    {
      name: 'checks every field when none is hidden',
      hidden: [] as ConsoleStoryRowField[],
      expectedChecked: [
        'Reactivation trigger fields',
        'Agent',
        'Story',
        'Status',
      ],
    },
    {
      name: 'unchecks only the hidden fields',
      hidden: ['agent', 'status'] as ConsoleStoryRowField[],
      expectedChecked: ['Reactivation trigger fields', 'Story'],
    },
  ])('$name', ({ hidden, expectedChecked }) => {
    const { getAllByRole } = render(
      <ConsoleStoryRowFieldToggles
        hiddenFields={hidden}
        onToggle={() => undefined}
      />,
    );
    const checked = getAllByRole('checkbox')
      .filter((box) => (box as HTMLInputElement).checked)
      .map((box) => box.closest('label')?.textContent ?? '');
    expect(checked).toEqual(expectedChecked);
  });

  it('reports the toggled field', () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ConsoleStoryRowFieldToggles hiddenFields={[]} onToggle={onToggle} />,
    );
    fireEvent.click(getByLabelText('Agent'));
    expect(onToggle).toHaveBeenCalledWith('agent');
  });
});
