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
  initialDestination: 'project',
  onSubmitProject: jest.fn().mockResolvedValue(undefined),
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

  it('calls onSubmitProject with correct params when the form is valid', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    const textarea = getByRole('textbox', { name: /title/i });
    fireEvent.change(textarea, { target: { value: 'My new task' } });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>({
        storyName: 'regular / workflow improvement',
        agentOptionId: null,
        title: 'My new task',
        body: null,
        files: [],
      }),
    );
  });

  it('calls onSubmitProject with body when body textarea is filled in', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with body' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Some body text' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: 'Some body text' }),
      ),
    );
  });

  it('calls onSubmitProject with body null when body is blank', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task no body' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ body: null }),
      ),
    );
  });

  it('calls onSubmitProject with agentOptionId when agent is selected', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task with agent' },
    });
    fireEvent.click(getByRole('button', { name: /developer/i }));
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ agentOptionId: 'agent-developer' }),
      ),
    );
  });

  it('calls onSubmitProject with storyName from the selected story', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
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
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
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

  it('calls onClose after onSubmitProject completes successfully', async () => {
    const onClose = jest.fn();
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
        onClose={onClose}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'My new task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows an error message when onSubmitProject rejects', async () => {
    const onSubmitProject = jest
      .fn()
      .mockRejectedValue(new Error('Network failure'));
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
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
    const onSubmitProject = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
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
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole, queryByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        storyEntries={[]}
        onSubmitProject={onSubmitProject}
      />,
    );
    expect(queryByRole('button', { name: /workflow improvement/i })).toBeNull();
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'No story task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>({
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

  it('shows initialSubmitError as the alert on mount without clicking Create', () => {
    render(
      <IssueCreateModalDialog
        {...baseProps}
        initialSubmitError="Some failure reason"
      />,
    );
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
      'Some failure reason',
    );
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

  it('initializes selectedFiles from initialDraft.files prop', () => {
    const mockFile = new File(['hello'], 'restored.txt', {
      type: 'text/plain',
    });
    const draft: IssueCreateDraft = {
      title: '',
      body: null,
      storyName: null,
      agentOptionId: null,
      files: [mockFile],
    };
    const { getByText } = render(
      <IssueCreateModalDialog {...baseProps} initialDraft={draft} />,
    );
    expect(getByText('restored.txt')).not.toBeNull();
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

  it('calls onSubmitProject with the selected files array', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
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
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({ files: [mockFile] }),
      ),
    );
  });

  it('calls onSubmitProject with empty files array when no file is selected', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Task no files' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
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

  it('renders .console-task-create-dialog-footer as a sibling of .console-task-create-dialog-body, placed after it', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const dialog = document.body.querySelector(
      '.console-task-create-dialog',
    ) as HTMLElement;
    const body = dialog.querySelector(
      '.console-task-create-dialog-body',
    ) as HTMLElement;
    const footer = dialog.querySelector(
      '.console-task-create-dialog-footer',
    ) as HTMLElement;
    expect(body).not.toBeNull();
    expect(footer).not.toBeNull();
    expect(footer.parentElement).toBe(dialog);
    expect(body.nextElementSibling).toBe(footer);
  });

  it('renders the Cancel/Create buttons inside .console-task-create-dialog-footer and not inside .console-task-create-dialog-body', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const body = document.body.querySelector(
      '.console-task-create-dialog-body',
    ) as HTMLElement;
    const footer = document.body.querySelector(
      '.console-task-create-dialog-footer',
    ) as HTMLElement;
    expect(
      body.querySelector('.console-task-create-dialog-actions'),
    ).toBeNull();
    expect(body.querySelector('.console-task-create-dialog-cancel')).toBeNull();
    expect(body.querySelector('.console-task-create-dialog-submit')).toBeNull();
    expect(
      footer.querySelector('.console-task-create-dialog-actions'),
    ).not.toBeNull();
    expect(
      footer.querySelector('.console-task-create-dialog-cancel'),
    ).not.toBeNull();
    expect(
      footer.querySelector('.console-task-create-dialog-submit'),
    ).not.toBeNull();
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
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    const longTitle = `${'A'.repeat(256)}overflow text here`;
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: longTitle },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          title: 'A'.repeat(256),
          body: 'overflow text here',
        }),
      ),
    );
  });

  it('prepends overflow to existing body when title exceeds 256 chars and body has content', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
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
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
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
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitProject={onSubmitProject}
      />,
    );
    const exactTitle = 'C'.repeat(256);
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: exactTitle },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() =>
      expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
        expect.objectContaining({
          title: exactTitle,
          body: null,
        }),
      ),
    );
  });

  it('renders Project and Workflow destination buttons when onSubmitWorkflow is provided', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(getByRole('button', { name: 'Project' })).not.toBeNull();
    expect(getByRole('button', { name: 'Workflow' })).not.toBeNull();
  });

  it('omits the Workflow destination button entirely when onSubmitWorkflow is undefined', () => {
    const { getByRole, queryByRole } = render(
      <IssueCreateModalDialog {...baseProps} />,
    );
    expect(getByRole('button', { name: 'Project' })).not.toBeNull();
    expect(queryByRole('button', { name: 'Workflow' })).toBeNull();
  });

  it('positions the destination selector immediately before the Close button with nothing else between', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const closeButton = getByRole('button', { name: 'Close' });
    const elementBeforeClose = closeButton.previousElementSibling;
    const projectButton = getByRole('button', { name: 'Project' });
    const workflowButton = getByRole('button', { name: 'Workflow' });
    expect(elementBeforeClose).not.toBeNull();
    expect(
      elementBeforeClose === projectButton ||
        elementBeforeClose === workflowButton ||
        (elementBeforeClose?.contains(projectButton) ?? false),
    ).toBe(true);
    expect(
      elementBeforeClose === workflowButton ||
        (elementBeforeClose?.contains(workflowButton) ?? false),
    ).toBe(true);
  });

  it('renders Project pressed and Workflow not pressed when initialDestination is "project"', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(
      getByRole('button', { name: 'Project' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('renders Workflow pressed and Project not pressed when initialDestination is "workflow"', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="workflow"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(
      getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Project' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('flips the destination selection when Workflow then Project are clicked', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const projectButton = getByRole('button', { name: 'Project' });
    const workflowButton = getByRole('button', { name: 'Workflow' });
    expect(projectButton.getAttribute('aria-pressed')).toBe('true');
    expect(workflowButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(workflowButton);
    expect(workflowButton.getAttribute('aria-pressed')).toBe('true');
    expect(projectButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(projectButton);
    expect(projectButton.getAttribute('aria-pressed')).toBe('true');
    expect(workflowButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('retains Title, Body, Story, and Agent values when the destination selection is switched to Workflow', () => {
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Persisted title' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Persisted body' },
    });
    const secondStoryButton = getByRole('button', {
      name: /regular \/ tdpm dashboard & console improvement/i,
    });
    fireEvent.click(secondStoryButton);
    const developerButton = getByRole('button', { name: /developer/i });
    fireEvent.click(developerButton);

    fireEvent.click(getByRole('button', { name: 'Workflow' }));

    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Persisted title',
    );
    expect(getByRole('textbox', { name: /body/i })).toHaveValue(
      'Persisted body',
    );
    expect(secondStoryButton.getAttribute('aria-pressed')).toBe('true');
    expect(developerButton.getAttribute('aria-pressed')).toBe('true');
  });

  it('retains Attachments when the destination selection is switched to Workflow', () => {
    const { getByRole, getByText } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const fileInput = document.body.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const mockFile = new File(['data'], 'persisted-attachment.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    expect(getByText('persisted-attachment.png')).not.toBeNull();

    fireEvent.click(getByRole('button', { name: 'Workflow' }));

    expect(getByText('persisted-attachment.png')).not.toBeNull();
  });

  it('calls onSubmitProject and not onSubmitWorkflow when Create is clicked with Project selected', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const onSubmitWorkflow = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitProject={onSubmitProject}
        onSubmitWorkflow={onSubmitWorkflow}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Project destination task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(onSubmitProject).toHaveBeenCalledTimes(1));
    expect(onSubmitWorkflow).not.toHaveBeenCalled();
  });

  it('calls onSubmitWorkflow and not onSubmitProject when Create is clicked with Workflow selected', async () => {
    const onSubmitProject = jest.fn().mockResolvedValue(undefined);
    const onSubmitWorkflow = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="workflow"
        onSubmitProject={onSubmitProject}
        onSubmitWorkflow={onSubmitWorkflow}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Workflow destination task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(onSubmitWorkflow).toHaveBeenCalledTimes(1));
    expect(onSubmitProject).not.toHaveBeenCalled();
  });

  it('disables both destination buttons while a submit is in flight', async () => {
    let resolveSubmit: (() => void) | undefined;
    const onSubmitProject = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitProject={onSubmitProject}
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'In-flight task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));
    await waitFor(() => expect(onSubmitProject).toHaveBeenCalled());
    expect(getByRole('button', { name: 'Project' })).toBeDisabled();
    expect(getByRole('button', { name: 'Workflow' })).toBeDisabled();
    await act(async () => {
      resolveSubmit?.();
    });
  });

  it('keeps Title, Body, Story, Agent, and the Project destination selection unchanged when onSubmitProject rejects', async () => {
    const onSubmitProject = jest
      .fn()
      .mockRejectedValue(new Error('Project submit failed'));
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitProject={onSubmitProject}
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Failing project task' },
    });
    fireEvent.change(getByRole('textbox', { name: /body/i }), {
      target: { value: 'Failing project body' },
    });
    const secondStoryButton = getByRole('button', {
      name: /regular \/ tdpm dashboard & console improvement/i,
    });
    fireEvent.click(secondStoryButton);
    const developerButton = getByRole('button', { name: /developer/i });
    fireEvent.click(developerButton);

    fireEvent.click(getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'Project submit failed',
      ),
    );
    expect(
      document.body.querySelector('.console-task-create-dialog'),
    ).not.toBeNull();
    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Failing project task',
    );
    expect(getByRole('textbox', { name: /body/i })).toHaveValue(
      'Failing project body',
    );
    expect(secondStoryButton.getAttribute('aria-pressed')).toBe('true');
    expect(developerButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      getByRole('button', { name: 'Project' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('keeps Title, Body, and the Workflow destination selection unchanged when onSubmitWorkflow rejects', async () => {
    const onSubmitWorkflow = jest
      .fn()
      .mockRejectedValue(new Error('Workflow submit failed'));
    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="workflow"
        onSubmitWorkflow={onSubmitWorkflow}
      />,
    );
    fireEvent.change(getByRole('textbox', { name: /title/i }), {
      target: { value: 'Failing workflow task' },
    });
    fireEvent.click(getByRole('button', { name: /^create$/i }));

    await waitFor(() =>
      expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
        'Workflow submit failed',
      ),
    );
    expect(
      document.body.querySelector('.console-task-create-dialog'),
    ).not.toBeNull();
    expect(getByRole('textbox', { name: /title/i })).toHaveValue(
      'Failing workflow task',
    );
    expect(
      getByRole('button', { name: 'Workflow' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('renders the same Story and Agent option names whether Project or Workflow is selected', () => {
    const collectOptionTexts = (): string[] =>
      [
        ...document.body.querySelectorAll(
          '.console-task-create-dialog-option-list button',
        ),
      ].map((button) => button.textContent ?? '');

    const { unmount } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const projectOptionTexts = collectOptionTexts();
    unmount();

    render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="workflow"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const workflowOptionTexts = collectOptionTexts();

    expect(projectOptionTexts.length).toBeGreaterThan(0);
    expect(projectOptionTexts).toEqual(workflowOptionTexts);
  });
});
