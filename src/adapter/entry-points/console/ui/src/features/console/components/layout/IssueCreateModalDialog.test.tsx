import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

  describe('workflow destination story and agent option source', () => {
    const workflowStoryEntries: ConsoleStoryEntry[] = [
      {
        storyName: 'Fleet task',
        storyOptionId: 'opt-fleet-task',
        color: 'GREEN',
        description: '',
        openItemCount: 0,
        storyViewUrl: null,
        items: [],
      },
    ];

    const workflowAgentOptions: ConsoleFieldOption[] = [
      { id: 'agent-fleet-operator', name: 'fleet-operator', color: 'PURPLE' },
    ];

    it('renders Story and Agent options from workflowStoryEntries/workflowAgentOptions, not from storyEntries/agentOptions, when destination is Workflow, and submits values from that list', async () => {
      const onSubmitWorkflow = jest.fn().mockResolvedValue(undefined);
      const { getByRole, queryByRole, getByText } = render(
        <IssueCreateModalDialog
          {...baseProps}
          initialDestination="workflow"
          onSubmitWorkflow={onSubmitWorkflow}
          workflowStoryEntries={workflowStoryEntries}
          workflowAgentOptions={workflowAgentOptions}
        />,
      );

      expect(getByText('Fleet task')).not.toBeNull();
      expect(getByText('fleet-operator')).not.toBeNull();
      expect(
        queryByRole('button', {
          name: /regular \/ workflow improvement/i,
        }),
      ).toBeNull();
      expect(queryByRole('button', { name: /^developer$/i })).toBeNull();

      fireEvent.click(getByRole('button', { name: 'Fleet task' }));
      fireEvent.click(getByRole('button', { name: 'fleet-operator' }));
      fireEvent.change(getByRole('textbox', { name: /title/i }), {
        target: { value: 'Workflow-sourced task' },
      });
      fireEvent.click(getByRole('button', { name: /^create$/i }));

      await waitFor(() => expect(onSubmitWorkflow).toHaveBeenCalledTimes(1));
      expect(onSubmitWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          storyName: 'Fleet task',
          agentOptionId: 'agent-fleet-operator',
        }),
      );
    });

    it('clears a previously selected Story and Agent option that is absent from the workflow list when destination switches to Workflow', () => {
      const { getByRole, queryByRole } = render(
        <IssueCreateModalDialog
          {...baseProps}
          initialDestination="project"
          onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
          workflowStoryEntries={workflowStoryEntries}
          workflowAgentOptions={workflowAgentOptions}
        />,
      );

      const viewedStoryButton = getByRole('button', {
        name: /regular \/ tdpm dashboard & console improvement/i,
      });
      fireEvent.click(viewedStoryButton);
      const viewedAgentButton = getByRole('button', { name: /^developer$/i });
      fireEvent.click(viewedAgentButton);
      expect(viewedStoryButton.getAttribute('aria-pressed')).toBe('true');
      expect(viewedAgentButton.getAttribute('aria-pressed')).toBe('true');

      fireEvent.click(getByRole('button', { name: 'Workflow' }));

      expect(
        queryByRole('button', {
          name: /regular \/ tdpm dashboard & console improvement/i,
        }),
      ).toBeNull();
      const workflowStoryButton = getByRole('button', { name: 'Fleet task' });
      const workflowAgentButton = getByRole('button', {
        name: 'fleet-operator',
      });
      expect(workflowStoryButton.getAttribute('aria-pressed')).toBe('false');
      expect(workflowAgentButton.getAttribute('aria-pressed')).toBe('false');
    });
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

  it('renders exactly 2 destination selector buttons named "Project" and "Workflow" when onSubmitWorkflow is provided', () => {
    render(
      <IssueCreateModalDialog
        {...baseProps}
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const destinationButtons = document.body.querySelectorAll(
      '.console-task-create-dialog-destination-selector button',
    );
    expect(destinationButtons.length).toBe(2);
    expect([...destinationButtons].map((button) => button.textContent)).toEqual(
      ['Project', 'Workflow'],
    );
  });

  it('renders exactly 1 destination selector button named "Project" when onSubmitWorkflow is undefined', () => {
    render(<IssueCreateModalDialog {...baseProps} />);
    const destinationButtons = document.body.querySelectorAll(
      '.console-task-create-dialog-destination-selector button',
    );
    expect(destinationButtons.length).toBe(1);
    expect([...destinationButtons].map((button) => button.textContent)).toEqual(
      ['Project'],
    );
  });

  it('renders identical Story and Agent option lists after switching from Project to Workflow when workflowStoryEntries and workflowAgentOptions are not provided', () => {
    const collectOptionListTexts = (): string[][] =>
      [
        ...document.body.querySelectorAll(
          '.console-task-create-dialog-option-list',
        ),
      ].map((optionList) =>
        [...optionList.querySelectorAll('button')].map(
          (button) => button.textContent ?? '',
        ),
      );

    const { getByRole } = render(
      <IssueCreateModalDialog
        {...baseProps}
        initialDestination="project"
        onSubmitWorkflow={jest.fn().mockResolvedValue(undefined)}
      />,
    );
    const [projectStoryTexts, projectAgentTexts] = collectOptionListTexts();

    fireEvent.click(getByRole('button', { name: 'Workflow' }));

    const [workflowStoryTexts, workflowAgentTexts] = collectOptionListTexts();

    expect(projectStoryTexts.length).toBeGreaterThan(0);
    expect(projectAgentTexts.length).toBeGreaterThan(0);
    expect(workflowStoryTexts).toEqual(projectStoryTexts);
    expect(workflowAgentTexts).toEqual(projectAgentTexts);
  });

  it('continues an unordered list item in the Body field with a new marker line when Enter is pressed at the end of a list line', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const textarea = getByRole('textbox', {
      name: /body/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '- first item' } });
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('- first item\n- ');
    expect(textarea.selectionStart).toBe('- first item\n- '.length);
    expect(textarea.selectionEnd).toBe('- first item\n- '.length);
  });

  it('exits the list in the Body field by clearing the marker when Enter is pressed on an empty list item line', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const textarea = getByRole('textbox', {
      name: /body/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '- ' } });
    textarea.setSelectionRange(2, 2);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('');
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(0);
  });

  it('leaves the Body field completely unchanged when Enter fires during IME composition', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const textarea = getByRole('textbox', {
      name: /body/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '- ' } });
    textarea.setSelectionRange(2, 2);
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    expect(textarea.value).toBe('- ');
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
  });

  it('does not intercept Enter in the Title field, leaving a list-item line to ordinary native newline handling unchanged', () => {
    const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
    const textarea = getByRole('textbox', {
      name: /title/i,
    }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '- ' } });
    textarea.setSelectionRange(2, 2);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(textarea.value).toBe('- ');
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionEnd).toBe(2);
  });

  describe('pinned current behavior for attachments and text fields', () => {
    it('lists one thumbnail img per selected image file, alt set to the file name, and skips non-image files', async () => {
      const cases: {
        label: string;
        files: { name: string; type: string }[];
        expectedAlts: string[];
      }[] = [
        {
          label: 'one image',
          files: [{ name: 'a.png', type: 'image/png' }],
          expectedAlts: ['a.png'],
        },
        {
          label: 'two images',
          files: [
            { name: 'a.png', type: 'image/png' },
            { name: 'b.jpg', type: 'image/jpeg' },
          ],
          expectedAlts: ['a.png', 'b.jpg'],
        },
        {
          label: 'image mixed with a text file',
          files: [
            { name: 'a.png', type: 'image/png' },
            { name: 'notes.txt', type: 'text/plain' },
          ],
          expectedAlts: ['a.png'],
        },
        {
          label: 'non-image file only',
          files: [{ name: 'doc.pdf', type: 'application/pdf' }],
          expectedAlts: [],
        },
      ];
      for (const testCase of cases) {
        const { unmount } = render(<IssueCreateModalDialog {...baseProps} />);
        const fileInput = document.body.querySelector(
          'input[type="file"]',
        ) as HTMLInputElement;
        const files = testCase.files.map(
          ({ name, type }) => new File(['data'], name, { type }),
        );
        await act(async () => {
          fireEvent.change(fileInput, { target: { files } });
        });
        const thumbnailAlts = [
          ...document.body.querySelectorAll<HTMLImageElement>(
            '.console-task-create-dialog-file-thumbnail',
          ),
        ].map((img) => img.alt);
        expect({ label: testCase.label, thumbnailAlts }).toEqual({
          label: testCase.label,
          thumbnailAlts: testCase.expectedAlts,
        });
        unmount();
      }
    });

    it('removes the thumbnail of an image attachment when its remove button is clicked', async () => {
      const { getByRole } = render(<IssueCreateModalDialog {...baseProps} />);
      const fileInput = document.body.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const files = [
        new File(['data'], 'a.png', { type: 'image/png' }),
        new File(['data'], 'b.jpg', { type: 'image/jpeg' }),
      ];
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      await act(async () => {
        fireEvent.click(getByRole('button', { name: 'Remove a.png' }));
      });
      const thumbnailAlts = [
        ...document.body.querySelectorAll<HTMLImageElement>(
          '.console-task-create-dialog-file-thumbnail',
        ),
      ].map((img) => img.alt);
      expect(thumbnailAlts).toEqual(['b.jpg']);
    });

    it('accepts typed text in the Title and Body textareas', () => {
      const cases = [
        { field: 'Title', value: 'Typed title' },
        { field: 'Body', value: 'Typed body' },
      ];
      for (const { field, value } of cases) {
        const { getByRole, unmount } = render(
          <IssueCreateModalDialog {...baseProps} />,
        );
        const textarea = getByRole('textbox', { name: field });
        fireEvent.change(textarea, { target: { value } });
        expect(textarea).toHaveValue(value);
        unmount();
      }
    });
  });

  describe('screenshot preview in the attachments list', () => {
    const PREVIEW_TEST_ID = 'console-task-create-dialog-file-preview';
    const THUMBNAIL_BUTTON_CLASS =
      'console-task-create-dialog-file-thumbnail-button';

    const imageFiles = (): File[] => [
      new File(['data'], 'a.png', { type: 'image/png' }),
      new File(['data'], 'b.jpg', { type: 'image/jpeg' }),
    ];

    const renderWithFiles = async (files: File[]) => {
      const result = render(<IssueCreateModalDialog {...baseProps} />);
      const fileInput = document.body.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      return result;
    };

    const thumbnailButtonsFor = (fileName: string): HTMLElement[] =>
      screen
        .queryAllByRole('button', {
          name: (accessibleName) => accessibleName.includes(fileName),
        })
        .filter((button) => button.classList.contains(THUMBNAIL_BUTTON_CLASS));

    const thumbnailButtonFor = (fileName: string): HTMLElement => {
      const buttons = thumbnailButtonsFor(fileName);
      expect(buttons).toHaveLength(1);
      const [button] = buttons;
      if (button === undefined) {
        throw new Error(`No thumbnail button for ${fileName}`);
      }
      return button;
    };

    const readPreview = (): {
      imageCount: number;
      alt: string | null;
      src: string | null;
    } | null => {
      const preview = screen.queryByTestId(PREVIEW_TEST_ID);
      if (preview === null) {
        return null;
      }
      const images = preview.querySelectorAll('img');
      return {
        imageCount: images.length,
        alt: images.item(0)?.getAttribute('alt') ?? null,
        src: images.item(0)?.getAttribute('src') ?? null,
      };
    };

    it('shows the clicked thumbnail file large in the preview, with the thumbnail URL and the file name as alt', async () => {
      const cases = [
        { label: 'a.png', fileName: 'a.png' },
        { label: 'b.jpg', fileName: 'b.jpg' },
      ];
      for (const { label, fileName } of cases) {
        const { unmount } = await renderWithFiles(imageFiles());
        const thumbnail = thumbnailButtonFor(fileName);
        const thumbnailSrc =
          thumbnail.querySelector('img')?.getAttribute('src') ?? null;
        fireEvent.click(thumbnail);
        expect({ label, preview: readPreview() }).toEqual({
          label,
          preview: { imageCount: 1, alt: fileName, src: thumbnailSrc },
        });
        unmount();
      }
    });

    it('toggles the preview by thumbnail: same thumbnail hides it, another thumbnail switches to it', async () => {
      const cases: {
        label: string;
        initiallyPreviewed: string | null;
        clicked: string;
        expectedAlt: string | null;
      }[] = [
        {
          label: 'no preview, click a.png',
          initiallyPreviewed: null,
          clicked: 'a.png',
          expectedAlt: 'a.png',
        },
        {
          label: 'no preview, click b.jpg',
          initiallyPreviewed: null,
          clicked: 'b.jpg',
          expectedAlt: 'b.jpg',
        },
        {
          label: 'a.png previewed, click a.png again',
          initiallyPreviewed: 'a.png',
          clicked: 'a.png',
          expectedAlt: null,
        },
        {
          label: 'a.png previewed, click b.jpg',
          initiallyPreviewed: 'a.png',
          clicked: 'b.jpg',
          expectedAlt: 'b.jpg',
        },
        {
          label: 'b.jpg previewed, click a.png',
          initiallyPreviewed: 'b.jpg',
          clicked: 'a.png',
          expectedAlt: 'a.png',
        },
        {
          label: 'b.jpg previewed, click b.jpg again',
          initiallyPreviewed: 'b.jpg',
          clicked: 'b.jpg',
          expectedAlt: null,
        },
      ];
      for (const testCase of cases) {
        const { unmount } = await renderWithFiles(imageFiles());
        if (testCase.initiallyPreviewed !== null) {
          fireEvent.click(thumbnailButtonFor(testCase.initiallyPreviewed));
        }
        fireEvent.click(thumbnailButtonFor(testCase.clicked));
        expect({
          label: testCase.label,
          previewAlt: readPreview()?.alt ?? null,
        }).toEqual({
          label: testCase.label,
          previewAlt: testCase.expectedAlt,
        });
        unmount();
      }
    });

    it('keeps the preview open while typing in Title or Body', async () => {
      const cases = [
        { field: 'Title', value: 'Typed while previewing' },
        { field: 'Body', value: 'Typed body while previewing' },
      ];
      for (const { field, value } of cases) {
        const { unmount } = await renderWithFiles(imageFiles());
        fireEvent.click(thumbnailButtonFor('a.png'));
        const textarea = screen.getByRole('textbox', { name: field });
        act(() => {
          textarea.focus();
        });
        expect(document.activeElement).toBe(textarea);
        fireEvent.change(textarea, { target: { value } });
        expect({ field, preview: readPreview() }).toEqual({
          field,
          preview: { imageCount: 1, alt: 'a.png', src: expect.any(String) },
        });
        unmount();
      }
    });

    it('hides the preview when the Close preview button is clicked', async () => {
      const { unmount } = await renderWithFiles(imageFiles());
      fireEvent.click(thumbnailButtonFor('a.png'));
      expect(readPreview()).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close preview' }));
      expect(readPreview()).toBeNull();
      unmount();
    });

    it('hides the preview when the previewed file is removed, and keeps it when another file is removed', async () => {
      const cases: {
        label: string;
        removed: string;
        expectedAlt: string | null;
      }[] = [
        {
          label: 'remove the previewed a.png',
          removed: 'a.png',
          expectedAlt: null,
        },
        {
          label: 'remove the other b.jpg',
          removed: 'b.jpg',
          expectedAlt: 'a.png',
        },
      ];
      for (const testCase of cases) {
        const { unmount } = await renderWithFiles(imageFiles());
        fireEvent.click(thumbnailButtonFor('a.png'));
        fireEvent.click(
          screen.getByRole('button', { name: `Remove ${testCase.removed}` }),
        );
        expect({
          label: testCase.label,
          previewAlt: readPreview()?.alt ?? null,
        }).toEqual({
          label: testCase.label,
          previewAlt: testCase.expectedAlt,
        });
        unmount();
      }
    });

    it('renders each thumbnail as a type=button button that contains the image, is focusable, and has the file name in its accessible name', async () => {
      const cases = [{ fileName: 'a.png' }, { fileName: 'b.jpg' }];
      for (const { fileName } of cases) {
        const { unmount } = await renderWithFiles(imageFiles());
        const button = thumbnailButtonFor(fileName);
        button.focus();
        expect({
          fileName,
          tagName: button.tagName,
          type: button.getAttribute('type'),
          containsImg: button.querySelector('img') !== null,
          foundByFileNameInAccessibleName:
            thumbnailButtonsFor(fileName).includes(button),
          focused: document.activeElement === button,
        }).toEqual({
          fileName,
          tagName: 'BUTTON',
          type: 'button',
          containsImg: true,
          foundByFileNameInAccessibleName: true,
          focused: true,
        });
        unmount();
      }
    });

    it('submits the title and the attached image files unchanged while the preview is open', async () => {
      const onSubmitProject = jest.fn().mockResolvedValue(undefined);
      const files = imageFiles();
      const { unmount } = render(
        <IssueCreateModalDialog
          {...baseProps}
          onSubmitProject={onSubmitProject}
        />,
      );
      const fileInput = document.body.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
        target: { value: 'Preview task' },
      });
      fireEvent.click(thumbnailButtonFor('b.jpg'));
      fireEvent.click(screen.getByRole('button', { name: /^create$/i }));
      await waitFor(() =>
        expect(onSubmitProject).toHaveBeenCalledWith<[IssueCreateParams]>(
          expect.objectContaining({ title: 'Preview task', files }),
        ),
      );
      unmount();
    });
  });
});
