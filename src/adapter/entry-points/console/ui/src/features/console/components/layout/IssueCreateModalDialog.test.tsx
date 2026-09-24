import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleFieldOption, ConsoleStoryEntry } from '../../logic/types';
import {
  type IssueCreateDraft,
  IssueCreateModalDialog,
  type IssueCreateModalDialogProps,
  type IssueCreateParams,
} from './IssueCreateModalDialog';

class MockFileReader {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  readAsDataURL(file: File): void {
    this.result = `data:${file.type};base64,dGVzdA==`;
    this.onloadend?.();
  }
}

beforeAll(() => {
  global.FileReader = MockFileReader as unknown as typeof FileReader;
});

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

  it('renders the body textarea', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    expect(getByRole('textbox', { name: /body/i })).not.toBeNull();
  });

  it('renders field order: body before attachments, attachments before story and agent selects', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const dialog = document.body.querySelector(
      '.console-task-create-dialog-body',
    ) as HTMLElement;
    const labels = [
      ...dialog.querySelectorAll('.console-task-create-dialog-section-label'),
    ].map((el) => el.textContent);
    const bodyIndex = labels.indexOf('Body');
    const attachmentsIndex = labels.indexOf('Attachments');
    const storyIndex = labels.indexOf('Story');
    const agentIndex = labels.indexOf('Agent');
    expect(bodyIndex).toBeGreaterThanOrEqual(0);
    expect(attachmentsIndex).toBeGreaterThan(bodyIndex);
    expect(storyIndex).toBeGreaterThan(attachmentsIndex);
    expect(agentIndex).toBeGreaterThan(storyIndex);
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
        storyName: 'regular / workflow improvement',
        agentOptionId: null,
        title: 'My new task',
        body: null,
        files: [],
      }),
    );
  });

  it('calls onSubmit with body when body textarea is filled in', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with body' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Some body text' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: 'Some body text' }),
      ),
    );
  });

  it('calls onSubmit with body null when body is blank', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task no body' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: null }),
      ),
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

  it('calls onSubmit with storyName from the selected story', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with story' },
    });
    fireEvent.click(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }),
    );
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          storyName: 'regular / tdpm dashboard & console improvement',
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

  it('submitting with zero storyEntries succeeds without story validation error', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        storyEntries={[]}
        onSubmit={onSubmit}
      />,
    );
    expect(queryByRole('button', { name: /workflow improvement/i })).toBeNull();
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'No story task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>({
        storyName: null,
        agentOptionId: null,
        title: 'No story task',
        body: null,
        files: [],
      }),
    );
    expect(queryByRole('alert')).toBeNull();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onClose={onClose} />,
    );
    fireEvent.click(getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking the overlay outside the dialog', () => {
    const onClose = jest.fn();
    render(<IssueCreateModalDialog {...baseProps} onClose={onClose} />);
    const overlay = document.body.querySelector(
      '.console-task-create-dialog-overlay',
    ) as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not call onClose when clicking inside the dialog', () => {
    const onClose = jest.fn();
    render(<IssueCreateModalDialog {...baseProps} onClose={onClose} />);
    const dialog = document.body.querySelector(
      '.console-task-create-dialog',
    ) as HTMLElement;
    fireEvent.click(dialog);
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

  it('initializes titleValue from initialDraft.title prop', () => {
    const draft: IssueCreateDraft = {
      title: 'Restored draft',
      body: null,
      storyName: null,
      agentOptionId: null,
    };
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} initialDraft={draft} />,
    );
    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Restored draft',
    );
  });

  it('initializes bodyValue from initialDraft.body prop', () => {
    const draft: IssueCreateDraft = {
      title: '',
      body: 'Restored body',
      storyName: null,
      agentOptionId: null,
    };
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} initialDraft={draft} />,
    );
    expect(getByRole('textbox', { name: /body/i })).toHaveValue(
      'Restored body',
    );
  });

  it('initializes story selection from initialDraft.storyName', () => {
    const draft: IssueCreateDraft = {
      title: '',
      body: null,
      storyName: 'regular / tdpm dashboard & console improvement',
      agentOptionId: null,
    };
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} initialDraft={draft} />,
    );
    expect(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      getByRole('button', {
        name: /regular \/ workflow improvement/i,
      }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('calls onDraftChange whenever the title textarea changes', () => {
    const onDraftChange = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onDraftChange={onDraftChange} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Typed text' },
    });
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Typed text' }),
    );
  });

  it('calls onDraftChange whenever the body textarea changes', () => {
    const onDraftChange = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onDraftChange={onDraftChange} />,
    );
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Body content' },
    });
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Body content' }),
    );
  });

  it('calls onDraftChange with storyName when story is selected', () => {
    const onDraftChange = jest.fn();
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onDraftChange={onDraftChange} />,
    );
    fireEvent.click(
      getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      }),
    );
    expect(onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({
        storyName: 'regular / tdpm dashboard & console improvement',
      }),
    );
  });

  it('renders color dot for each story entry', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const dots = document.body.querySelectorAll('.console-story-dot');
    expect(dots.length).toBe(storyEntries.length);
    const firstDot = dots[0] as HTMLElement;
    expect(firstDot.style.backgroundColor).toBeTruthy();
  });

  it('renders the file input for attachments', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    expect(fileInput.multiple).toBe(true);
  });

  it('shows file names after files are selected via the file input', () => {
    const { getByText } = render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    expect(getByText('hello.txt')).not.toBeNull();
  });

  it('shows a thumbnail img for image files using a data URL', async () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['data'], 'photo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });
    const thumbnail = document.body.querySelector(
      '.console-task-create-dialog-file-thumbnail',
    ) as HTMLImageElement;
    expect(thumbnail).not.toBeNull();
    expect(thumbnail.getAttribute('src')).toBe(
      'data:image/png;base64,dGVzdA==',
    );
  });

  it('clears thumbnails when files are replaced', async () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['data'], 'photo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });
    expect(
      document.body.querySelector('.console-task-create-dialog-file-thumbnail'),
    ).not.toBeNull();
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [] } });
    });
    expect(
      document.body.querySelector('.console-task-create-dialog-file-thumbnail'),
    ).toBeNull();
  });

  it('does not show a thumbnail img for non-image files', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['data'], 'doc.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    expect(
      document.body.querySelector('.console-task-create-dialog-file-thumbnail'),
    ).toBeNull();
  });

  it('removes a file when its remove button is clicked', () => {
    const { queryByText } = render(<IssueCreateModalDialog {...baseProps} />);
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['hello'], 'remove-me.txt', {
      type: 'text/plain',
    });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    const removeButton = document.body.querySelector(
      '[aria-label="Remove remove-me.txt"]',
    ) as HTMLElement;
    expect(removeButton).not.toBeNull();
    fireEvent.click(removeButton);
    expect(queryByText('remove-me.txt')).toBeNull();
  });

  it('calls onSubmit with the selected files array', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with files' },
    });
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['data'], 'attachment.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ files: [mockFile] }),
      ),
    );
  });

  it('calls onSubmit with empty files array when no file is selected', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task no files' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ files: [] }),
      ),
    );
  });

  it('renders fleet task create link when fleetTaskCreateUrl is provided', () => {
    const fleetUrl =
      'https://github.com/HiromiShikata/umino-corporait-operation/issues/new';
    render(
      <IssueCreateModalDialog {...baseProps} fleetTaskCreateUrl={fleetUrl} />,
    );
    const link = document.body.querySelector(
      '.console-task-create-dialog-fleet-link',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe(fleetUrl);
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noreferrer');
  });

  it('does not render fleet task create link when fleetTaskCreateUrl is not provided', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    expect(
      document.body.querySelector('.console-task-create-dialog-fleet-link'),
    ).toBeNull();
  });

  it('renders Cancel button before Create button in DOM order', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const actionsDiv = document.body.querySelector(
      '.console-task-create-dialog-actions',
    ) as HTMLElement;
    const buttons = [...actionsDiv.querySelectorAll('button')];
    const cancelIndex = buttons.findIndex((b) =>
      /^cancel$/i.test(b.textContent ?? ''),
    );
    const createIndex = buttons.findIndex((b) =>
      /^create$/i.test(b.textContent ?? ''),
    );
    expect(cancelIndex).toBeGreaterThanOrEqual(0);
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(cancelIndex).toBeLessThan(createIndex);
  });

  it('renders new issue tab link when newIssueUrl is provided', () => {
    const newIssueUrl =
      'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/new';
    render(<IssueCreateModalDialog {...baseProps} newIssueUrl={newIssueUrl} />);
    const link = document.body.querySelector(
      '.console-task-create-dialog-new-issue-link',
    ) as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.href).toBe(newIssueUrl);
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noreferrer');
  });

  it('does not render new issue tab link when newIssueUrl is not provided', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    expect(
      document.body.querySelector('.console-task-create-dialog-new-issue-link'),
    ).toBeNull();
  });

  it('does not render new issue tab link when newIssueUrl is null', () => {
    render(<IssueCreateModalDialog {...baseProps} newIssueUrl={null} />);
    expect(
      document.body.querySelector('.console-task-create-dialog-new-issue-link'),
    ).toBeNull();
  });

  it('truncates title to 256 chars and moves overflow to body when title exceeds 256 characters', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const longTitle = `${'A'.repeat(256)}overflow text here`;
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: longTitle },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          title: 'A'.repeat(256),
          body: 'overflow text here',
        }),
      ),
    );
  });

  it('prepends overflow to existing body when title exceeds 256 chars and body has content', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const longTitle = `${'B'.repeat(256)}extra`;
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: longTitle },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'existing body' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          title: 'B'.repeat(256),
          body: 'extra\nexisting body',
        }),
      ),
    );
  });

  it('adds containerClassName to the portal container div alongside the default class', () => {
    render(
      <IssueCreateModalDialog
        {...baseProps}
        containerClassName="extra-class"
      />,
    );
    const container = document.querySelector(
      '.console-task-create-dialog-container.extra-class',
    );
    expect(container).not.toBeNull();
  });

  it('does not truncate title when it is exactly 256 characters', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog {...baseProps} onSubmit={onSubmit} />,
    );
    const exactTitle = 'C'.repeat(256);
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: exactTitle },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          title: exactTitle,
          body: null,
        }),
      ),
    );
  });
});
