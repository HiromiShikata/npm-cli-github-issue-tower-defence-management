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

  it('renders a body textarea', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    expect(getByRole('textbox', { name: /body/i })).not.toBeNull();
  });

  it('calls onSubmit with body: null when body textarea is empty', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: null }),
      ),
    );
  });

  it('calls onSubmit with body: null when body textarea contains only whitespace', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: '   ' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: null }),
      ),
    );
  });

  it('calls onSubmit with body text when body textarea is filled', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Detailed description here' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: 'Detailed description here' }),
      ),
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
        body: null,
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

  it('renders with no agent options', () => {
    const { queryByRole } = render(
      <IssueCreateModalDialog {...baseProps} agentOptions={[]} />,
    );
    expect(queryByRole('button', { name: /developer/i })).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
