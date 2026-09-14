import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
import {
  IssueCreateModalDialog,
  type IssueCreateModalDialogProps,
  type IssueCreateParams,
} from './IssueCreateModalDialog';

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
  { id: 'agent-chore', name: 'chore', color: 'GRAY' },
];

const baseProps: IssueCreateModalDialogProps = {
  storyEntries,
  agentOptions,
  onSubmit: jest.fn().mockResolvedValue(undefined),
  onClose: jest.fn(),
};

describe('IssueCreateModalDialog', () => {
  it('renders story buttons for each story entry', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    expect(
      getByRole('button', { name: /regular \/ workflow improvement/i }),
    ).not.toBeNull();
    expect(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }),
    ).not.toBeNull();
  });

  it('renders agent buttons for each agent option', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    expect(getByRole('button', { name: /developer/i })).not.toBeNull();
    expect(getByRole('button', { name: /chore/i })).not.toBeNull();
  });

  it('selects the first story by default', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const firstStoryButton = getByRole('button', {
      name: /regular \/ workflow improvement/i,
    });
    expect(firstStoryButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('has no agent selected by default', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const developerButton = getByRole('button', { name: /developer/i });
    expect(developerButton.getAttribute('aria-pressed')).toBe('false');
    const choreButton = getByRole('button', { name: /chore/i });
    expect(choreButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('selects a story when its button is clicked', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const secondStoryButton = getByRole('button', {
      name: /regular \/ tdpm dashboard & console improvement/i,
    });
    fireEvent.click(secondStoryButton);
    expect(secondStoryButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      getByRole('button', {
        name: /regular \/ workflow improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('selects an agent when its button is clicked', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const developerButton = getByRole('button', { name: /developer/i });
    fireEvent.click(developerButton);
    expect(developerButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      getByRole('button', { name: /chore/i }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('deselects an agent when its button is clicked again', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const developerButton = getByRole('button', { name: /developer/i });
    fireEvent.click(developerButton);
    expect(developerButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(developerButton);
    expect(developerButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('auto-focuses the title textarea on mount', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const textarea = getByRole('textbox', { name: /title/i });
    expect(document.activeElement).toBe(textarea);
  });

  it('shows an error when submitting with empty title', async () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull(),
    );
  });

  it('calls onSubmit with correct params when the form is valid', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const textarea = getByRole('textbox', { name: /title/i });
    fireEvent.change(textarea, { target: { value: 'My new task' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>({
        storyOptionId: 'opt-workflow-improvement',
        agentOptionId: null,
        title: 'My new task',
        referenceUrl: null,
        files: [],
      }),
    );
  });

  it('calls onSubmit with agentOptionId when agent is selected', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with agent' },
    });
    fireEvent.click(getByRole('button', { name: /developer/i }));
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ agentOptionId: 'agent-developer' }),
      ),
    );
  });

  it('calls onSubmit with referenceUrl when reference URL is filled in', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, getByPlaceholderText } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with ref' },
    });
    fireEvent.change(getByPlaceholderText(/paste current task url/i), {
      target: {
        value:
          'https://github.com/HiromiShikata/umino-corporait-operation/issues/99',
      },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          referenceUrl:
            'https://github.com/HiromiShikata/umino-corporait-operation/issues/99',
        }),
      ),
    );
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose after onSubmit completes successfully', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an error message when onSubmit rejects', async () => {
    const onSubmit = jest.fn().mockRejectedValue(new Error('Network failure'));
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Failing task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'Network failure',
      ),
    );
  });

  it('clears error on successful retry', async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const textarea = getByRole('textbox', { name: /title/i });
    fireEvent.change(textarea, { target: { value: 'Retry task' } });
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /^create$/i }));
    });
    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')).not.toBeNull(),
    );
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')).toBeNull(),
    );
  });

  it('renders with no agent options - does not show agent section', () => {
    const { queryByRole } = render(
      <IssueCreateModalDialog {...baseProps} agentOptions={[]} />,
    );
    expect(queryByRole('button', { name: /developer/i })).toBeNull();
    expect(queryByRole('button', { name: /chore/i })).toBeNull();
  });

  it('renders the Reference URL input', () => {
    const { getByPlaceholderText } = render(
      <IssueCreateModalDialog {...baseProps} />,
    );
    expect(getByPlaceholderText(/paste current task url/i)).not.toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close when clicking the overlay outside the dialog', () => {
    const onClose = jest.fn();
    render(<IssueCreateModalDialog {...baseProps} onClose={onClose} />);
    const overlay = document.body.querySelector(
      '.console-task-create-dialog-overlay',
    ) as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('resets selectedStoryOptionId to the first entry when storyEntries changes to a different set', () => {
    const { rerender, getByRole } = render(
      <IssueCreateModalDialog {...baseProps} storyEntries={storyEntries} />,
    );
    expect(
      getByRole('button', {
        name: /regular \/ workflow improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('true');

    const newStoryEntries: ConsoleStoryEntry[] = [
      {
        storyName: 'new story entry',
        storyOptionId: 'new-opt',
        color: 'GREEN',
        description: '',
        openItemCount: 0,
        storyViewUrl: null,
        items: [],
      },
    ];
    rerender(
      <IssueCreateModalDialog {...baseProps} storyEntries={newStoryEntries} />,
    );

    expect(
      getByRole('button', { name: /new story entry/i }).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });

  it('preserves selectedStoryOptionId when storyEntries re-renders with same storyOptionIds in a new array reference', () => {
    const { rerender, getByRole } = render(
      <IssueCreateModalDialog {...baseProps} storyEntries={storyEntries} />,
    );
    fireEvent.click(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }),
    );
    expect(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('true');

    const sameStoriesNewRef: ConsoleStoryEntry[] = storyEntries.map((e) => ({
      ...e,
    }));
    rerender(
      <IssueCreateModalDialog
        {...baseProps}
        storyEntries={sameStoriesNewRef}
      />,
    );

    expect(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('initializes titleValue from initialTitle prop', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} initialTitle="Restored draft" />,
    );
    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Restored draft',
    );
  });

  it('calls onTitleChange whenever the title textarea changes', () => {
    const onTitleChange = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onTitleChange={onTitleChange} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Typed text' },
    });
    expect(onTitleChange).toHaveBeenCalledWith('Typed text');
  });

  it('renders color dot for each story entry', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const dots = document.body.querySelectorAll('.console-story-dot');
    expect(dots.length).toBe(storyEntries.length);
    const firstDot = dots[0] as HTMLElement;
    expect(firstDot.style.backgroundColor).toBeTruthy();
  });
});
