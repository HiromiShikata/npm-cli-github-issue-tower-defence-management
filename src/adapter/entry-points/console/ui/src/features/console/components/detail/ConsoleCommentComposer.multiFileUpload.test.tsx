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

  it('matches same-name upload results to placeholders by request index', async () => {
    const firstFile = new File(['first'], 'image.png', { type: 'image/png' });
    const secondFile = new File(['second'], 'image.png', {
      type: 'image/png',
    });
    const uploadFiles = jest.fn(async (): Promise<string> =>
      JSON.stringify([
        {
          fileName: firstFile.name,
          status: 'uploaded',
          markdown: '![first](https://example.test/first)',
        },
        {
          fileName: secondFile.name,
          status: 'uploaded',
          markdown: '![second](https://example.test/second)',
        },
      ]),
    );
    const { getByLabelText, getByPlaceholderText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={submitComment}
        onUploadFile={uploadFiles}
      />,
    );

    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [firstFile, secondFile] },
    });

    await waitFor(() => {
      expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
        '\n\n\n![first](https://example.test/first)\n![second](https://example.test/second)\n',
      );
    });
  });

  it('does not write a completed upload through the composer after navigation', async () => {
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
    rerender(
      <ConsoleCommentComposer
        key="task-a"
        initiallyOpen
        initialDraft={
          '\n\n\n![origin.png](https://github.com/user-attachments/origin)\n'
        }
        onSubmit={submitComment}
        onDraftChange={onDraftChange}
        onUploadFile={uploadFile}
      />,
    );
    const draftChangeCallsAfterReturning = onDraftChange.mock.calls.length;
    resolveUpload('![origin.png](https://github.com/user-attachments/origin)');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onDraftChange).toHaveBeenCalledTimes(draftChangeCallsAfterReturning);
    expect(getByPlaceholderText('Leave a comment…')).toHaveValue(
      '\n\n\n![origin.png](https://github.com/user-attachments/origin)\n',
    );
  });

  it('does not write a draft after the composer unmounts during an upload', async () => {
    let resolveUpload!: (markdown: string) => void;
    const onDraftChange = jest.fn();
    const uploadFile = jest.fn(
      () => new Promise<string>((resolve) => (resolveUpload = resolve)),
    );
    const { getByLabelText, unmount } = render(
      <ConsoleCommentComposer
        initiallyOpen
        onSubmit={submitComment}
        onDraftChange={onDraftChange}
        onUploadFile={uploadFile}
      />,
    );
    const file = new File(['binary'], 'unmounted.png', { type: 'image/png' });
    fireEvent.change(getByLabelText('Attach files'), {
      target: { files: [file] },
    });
    await waitFor(() => expect(uploadFile).toHaveBeenCalledTimes(1));

    const draftChangeCallsAtUnmount = onDraftChange.mock.calls.length;
    unmount();
    resolveUpload('![unmounted.png](https://example.test/unmounted)');

    await act(async () => {
      await Promise.resolve();
    });
    expect(onDraftChange).toHaveBeenCalledTimes(draftChangeCallsAtUnmount);
  });

  it('does not post a draft that still holds an upload placeholder after the composer remounts', () => {
    const onDraftChange = jest.fn();
    const submitCommentMock = jest.fn(submitComment);
    const { getByText } = render(
      <ConsoleCommentComposer
        initiallyOpen
        initialDraft={'\n\n\n![uploading x.png]()\n'}
        onSubmit={submitCommentMock}
        onDraftChange={onDraftChange}
      />,
    );
    const commentButton = getByText('Comment');

    expect(commentButton).toBeDisabled();
    fireEvent.click(commentButton);
    expect(submitCommentMock).not.toHaveBeenCalled();
  });

  it('keeps an upload pending at 300000 ms and times out at 360000 ms with a retryable error', async () => {
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
      const textarea = getByPlaceholderText(
        'Leave a comment…',
      ) as HTMLTextAreaElement;
      const file = new File(['binary'], 'slow.png', { type: 'image/png' });
      fireEvent.change(getByLabelText('Attach files'), {
        target: { files: [file] },
      });
      expect(textarea).toHaveValue('\n\n\n![uploading slow.png]()\n');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(300000);
      });
      expect(textarea.value).toContain('uploading');
      expect(queryByText(/Upload failed/)).toBeNull();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60000);
      });
      expect(textarea.value).not.toContain('uploading');
      expect(queryByText(/Upload failed/)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });
});
