import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleComment } from '../../logic/types';
import {
  appendAttachmentMarkdown,
  ConsoleCommentComposer,
} from './ConsoleCommentComposer';

jest.mock('../../lib/mermaidLoader', () => ({
  renderMermaidToSvg: jest.fn(async () => '<svg></svg>'),
}));

describe('ConsoleCommentComposer', () => {
  it('shows the form when it starts open', () => {
    const { getByPlaceholderText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
  });

  it('offers the opening control and hides the form when it starts closed', () => {
    const { queryByPlaceholderText, getByText } = render(
      <ConsoleCommentComposer
        initiallyOpen={false}
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    expect(queryByPlaceholderText('Leave a comment…')).toBeNull();
    expect(getByText('💬 Add a comment')).toBeInTheDocument();
  });

  it('opens the form on the control and closes it again so the body regains the height', () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
      <ConsoleCommentComposer
        initiallyOpen={false}
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    fireEvent.click(getByText('💬 Add a comment'));
    expect(getByPlaceholderText('Leave a comment…')).toBeInTheDocument();
    fireEvent.click(getByText('✕ Close'));
    expect(queryByPlaceholderText('Leave a comment…')).toBeNull();
  });

  it('submits the comment, empties the draft and renders no comment of its own', async () => {
    const onSubmit = jest.fn(
      async (body: string): Promise<ConsoleComment> => ({
        author: 'HiromiShikata',
        body,
        createdAt: '2026-06-19T11:58:00.000Z',
      }),
    );
    const { container, getByPlaceholderText, getByText, queryByText } = render(
      <ConsoleCommentComposer initiallyOpen onSubmit={onSubmit} />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'Looks good after the rebase.' },
    });
    fireEvent.click(getByText('Comment'));
    await waitFor(() => {
      expect(getByPlaceholderText('Leave a comment…')).toHaveValue('');
    });
    expect(onSubmit).toHaveBeenCalledWith('Looks good after the rebase.');
    expect(queryByText('Looks good after the rebase.')).toBeNull();
    expect(container.querySelectorAll('.console-comment').length).toBe(0);
  });

  it('shows a failure message when the submission rejects', async () => {
    const { getByPlaceholderText, getByText, findByRole } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async () => {
          throw new Error('HTTP 500');
        }}
      />,
    );
    fireEvent.change(getByPlaceholderText('Leave a comment…'), {
      target: { value: 'This should fail to post.' },
    });
    fireEvent.click(getByText('Comment'));
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('HTTP 500');
  });

  it('does not render the attach control when no upload handler is given', () => {
    const { queryByText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
      />,
    );
    expect(queryByText('📎 Attach files')).toBeNull();
  });

  it('uploads a selected file and inserts the returned markdown into the draft', async () => {
    const onUploadFile = jest.fn(
      async () => '![shot](https://github.com/user-attachments/assets/abc)',
    );
    const { getByPlaceholderText, getByLabelText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
        onUploadFile={onUploadFile}
      />,
    );
    const textarea = getByPlaceholderText(
      'Leave a comment…',
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'See the screen:' } });
    const file = new File(['binary'], 'shot.png', { type: 'image/png' });
    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(textarea.value).toBe(
        'See the screen:\n![shot](https://github.com/user-attachments/assets/abc)\n',
      );
    });
    expect(onUploadFile).toHaveBeenCalledWith(file);
  });

  it('uploads a pasted file', async () => {
    const onUploadFile = jest.fn(
      async () => '![pasted](https://github.com/user-attachments/assets/def)',
    );
    const { getByPlaceholderText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
        onUploadFile={onUploadFile}
      />,
    );
    const textarea = getByPlaceholderText(
      'Leave a comment…',
    ) as HTMLTextAreaElement;
    const file = new File(['binary'], 'pasted.png', { type: 'image/png' });
    fireEvent.paste(textarea, { clipboardData: { files: [file] } });
    await waitFor(() => {
      expect(textarea.value).toBe(
        '![pasted](https://github.com/user-attachments/assets/def)\n',
      );
    });
    expect(onUploadFile).toHaveBeenCalledWith(file);
  });

  it('uploads a dropped file', async () => {
    const onUploadFile = jest.fn(
      async () => '![dropped](https://github.com/user-attachments/assets/ghi)',
    );
    const { getByPlaceholderText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
        onUploadFile={onUploadFile}
      />,
    );
    const textarea = getByPlaceholderText(
      'Leave a comment…',
    ) as HTMLTextAreaElement;
    const file = new File(['binary'], 'dropped.png', { type: 'image/png' });
    fireEvent.drop(textarea, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(textarea.value).toBe(
        '![dropped](https://github.com/user-attachments/assets/ghi)\n',
      );
    });
    expect(onUploadFile).toHaveBeenCalledWith(file);
  });

  it('shows the upload failure reason when the upload rejects', async () => {
    const { getByLabelText, findByRole } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={async (body) => ({
          author: 'HiromiShikata',
          body,
          createdAt: '2026-06-19T11:58:00.000Z',
        })}
        onUploadFile={async () => {
          throw new Error('No GitHub web session is available');
        }}
      />,
    );
    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [new File(['x'], 'shot.png', { type: 'image/png' })] },
    });
    const alert = await findByRole('alert');
    expect(alert.textContent).toContain('No GitHub web session is available');
  });
});

describe('appendAttachmentMarkdown', () => {
  it('returns the markdown alone when the draft is empty', () => {
    expect(appendAttachmentMarkdown('', '![a](b)')).toBe('![a](b)\n');
  });

  it('adds a separating newline when the draft does not end with one', () => {
    expect(appendAttachmentMarkdown('hello', '![a](b)')).toBe(
      'hello\n![a](b)\n',
    );
  });

  it('does not add a second newline when the draft already ends with one', () => {
    expect(appendAttachmentMarkdown('hello\n', '![a](b)')).toBe(
      'hello\n![a](b)\n',
    );
  });
});
