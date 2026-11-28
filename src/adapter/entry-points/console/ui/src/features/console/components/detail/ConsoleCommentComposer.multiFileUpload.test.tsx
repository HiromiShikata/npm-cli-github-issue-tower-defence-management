import { act, fireEvent, render, waitFor } from '@testing-library/react';
import type { ConsoleComment } from '../../logic/types';
import { ConsoleCommentComposer } from './ConsoleCommentComposer';

const submitComment = async (body: string): Promise<ConsoleComment> => ({
  id: 1,
  author: 'HiromiShikata',
  body,
  createdAt: '2026-06-19T11:58:00.000Z',
});

describe('ConsoleCommentComposer multi-file attachment acceptance', () => {
  it.each([
    ['chosen', 'change'],
    ['pasted', 'paste'],
    ['dropped', 'drop'],
  ] as const)(
    'sends %s files in one upload request',
    async (_source, eventName) => {
      const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
      const secondFile = new File(['second'], 'second.png', {
        type: 'image/png',
      });
      const uploadFiles = jest.fn(
        async (files: File | File[]): Promise<string> => {
          const selectedFiles = Array.isArray(files) ? files : [files];
          return selectedFiles
            .map(
              (file) =>
                `![${file.name}](https://github.com/user-attachments/${file.name})`,
            )
            .join('\n');
        },
      );
      const { getByLabelText, getByPlaceholderText } = render(
        <ConsoleCommentComposer
          initiallyOpen
          onSubmit={submitComment}
          onUploadFile={uploadFiles}
        />,
      );
      const textarea = getByPlaceholderText('Leave a comment…');
      if (eventName === 'change') {
        fireEvent.change(getByLabelText('Attach files'), {
          target: { files: [firstFile, secondFile] },
        });
      } else if (eventName === 'paste') {
        fireEvent.paste(textarea, {
          clipboardData: { files: [firstFile, secondFile] },
        });
      } else {
        fireEvent.drop(textarea, {
          dataTransfer: { files: [firstFile, secondFile] },
        });
      }

      await waitFor(() => {
        expect(uploadFiles).toHaveBeenCalledTimes(1);
        expect(uploadFiles).toHaveBeenCalledWith([firstFile, secondFile]);
      });
    },
  );

  it('keeps successful links, removes a failed placeholder, and reports the failed file', async () => {
    const firstFile = new File(['first'], 'first.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'second.png', {
      type: 'image/png',
    });
    const uploadFiles = jest.fn(
      async (_files: File | File[]): Promise<string> =>
        JSON.stringify([
          {
            fileName: firstFile.name,
            status: 'uploaded',
            markdown: '![first.png](https://github.com/user-attachments/first)',
          },
          {
            fileName: secondFile.name,
            status: 'failed',
            error: 'second failed',
          },
        ]),
    );
    const { getByLabelText, getByPlaceholderText, findByRole } = render(
      <ConsoleCommentComposer
        key="task-a"
        initiallyOpen
        onSubmit={submitComment}
        onUploadFile={uploadFiles}
      />,
    );
    const textarea = getByPlaceholderText('Leave a comment…');
    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [firstFile, secondFile] },
    });

    await waitFor(() => {
      expect(textarea).toHaveValue(
        '\n\n\n![first.png](https://github.com/user-attachments/first)\n',
      );
    });
    expect((await findByRole('alert')).textContent).toContain('second failed');
    expect(textarea).not.toHaveValue(expect.stringContaining('uploading'));
  });

  it('writes a completed upload into the originating task draft after navigation', async () => {
    let resolveUpload!: (markdown: string) => void;
    const onDraftChange = jest.fn();
    const uploadFile = jest.fn(
      () => new Promise<string>((resolve) => (resolveUpload = resolve)),
    );
    const { getByLabelText, getByPlaceholderText, rerender } = render(
      <ConsoleCommentComposer
        key="task-a"
        initiallyOpen
        onSubmit={submitComment}
        onDraftChange={onDraftChange}
        onUploadFile={uploadFile}
      />,
    );
    const file = new File(['binary'], 'origin.png', { type: 'image/png' });
    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        '\n\n\n![uploading origin.png]()\n',
      );
    });
    rerender(
      <ConsoleCommentComposer
        key="task-b"
        initiallyOpen
        initialDraft="Task B draft"
        onSubmit={submitComment}
        onDraftChange={onDraftChange}
        onUploadFile={uploadFile}
      />,
    );
    resolveUpload('![origin.png](https://github.com/user-attachments/origin)');

    await waitFor(() => {
      expect(onDraftChange).toHaveBeenCalledWith(
        '\n\n\n![origin.png](https://github.com/user-attachments/origin)\n',
      );
    });
  });

  it('aborts an upload after 300000 ms and clears placeholders with a retryable error', async () => {
    jest.useFakeTimers();
    try {
      const uploadFile = jest.fn(() => new Promise<string>(() => {}));
      const { getByLabelText, getByPlaceholderText, queryByText } = render(
        <ConsoleCommentComposer
          initiallyOpen
          onSubmit={submitComment}
          onUploadFile={uploadFile}
        />,
      );
      const file = new File(['binary'], 'slow.png', { type: 'image/png' });
      fireEvent.change(getByLabelText('Attach files'), {
        target: { files: [file] },
      });
      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        '\n\n\n![uploading slow.png]()\n',
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(300000);
      });
      expect(getByPlaceholderText('Leave a comment…')).not.toHaveValue(
        expect.stringContaining('uploading'),
      );
      expect(queryByText(/Upload failed/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
