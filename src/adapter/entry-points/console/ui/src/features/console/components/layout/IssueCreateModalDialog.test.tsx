import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleStoryEntry } from '../../logic/types';
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

const baseProps: IssueCreateModalDialogProps = {
  storyEntries,
  onSubmit: jest.fn(),
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

  it('selects the first story by default', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const firstStoryButton = getByRole('button', {
      name: /regular \/ workflow improvement/i,
    });
    expect(firstStoryButton.getAttribute('aria-pressed')).toBe('true');
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

  it('calls onSubmit with correct params when the form is valid', () => {
    const onSubmit = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const textarea = getByRole('textbox', { name: /title/i });
    fireEvent.change(textarea, { target: { value: 'My new task' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>({
      storyOptionId: 'opt-workflow-improvement',
      title: 'My new task',
    });
  });

  it('calls onClose after onSubmit when the form is valid', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders color dot for each story entry', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const dots = document.body.querySelectorAll('.console-story-dot');
    expect(dots.length).toBe(storyEntries.length);
    const firstDot = dots[0] as HTMLElement;
    expect(firstDot.style.backgroundColor).toBeTruthy();
  });

  it('does not render a Reference URL input', () => {
    const { queryByPlaceholderText } = render(
      <IssueCreateModalDialog {...baseProps} />,
    );
    expect(queryByPlaceholderText(/paste current task url/i)).toBeNull();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
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

  it('resets selectedStoryOptionId to the first entry when storyEntries prop changes', () => {
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
});
