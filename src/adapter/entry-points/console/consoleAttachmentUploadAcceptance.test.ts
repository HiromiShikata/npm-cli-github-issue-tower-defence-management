import type { ConsoleOperationContext } from './consoleOperationApi';
import { handleAttachmentUpload } from './consoleOperationApi';

type AttachmentUploadRequest = {
  issueOrPullRequestUrl: string;
  files: { fileName: string; content: Uint8Array }[];
};

type AttachmentUploadResult =
  | { fileName: string; status: 'uploaded'; markdown: string }
  | { fileName: string; status: 'failed'; error: string };

const uploadContext = (
  uploadAttachment: (
    request: AttachmentUploadRequest,
  ) => Promise<AttachmentUploadResult[]>,
): ConsoleOperationContext => ({
  resolveIssueRepository: () => {
    throw new Error('issue repository is not used by attachment upload');
  },
  resolveProject: async () => null,
  isPjcodeConfigured: () => true,
  isRepositoryConfigured: () => true,
  consoleDataOutputDir: null,
  issueAttachmentRepository: {
    uploadAttachment: async (request) => {
      if (!('files' in request)) {
        throw new Error('single-file upload is not used by this test');
      }
      return uploadAttachment(request);
    },
  },
  resolveProjectRepository: null,
  invalidateProject: null,
  updateProjectCacheEntry: null,
  patchItemIntoQueuedTab: null,
  resolveWorkflowProjectBinding: null,
  workflowRepositoryNameWithOwner: null,
});

describe('multi-file console attachment upload contract', () => {
  it('accepts one request containing every file and returns one result per file', async () => {
    const uploadAttachment = {
      uploadAttachment: jest.fn(async (request: AttachmentUploadRequest) =>
        request.files.map((file) => ({
          fileName: file.fileName,
          status: 'uploaded' as const,
          markdown:
            file.fileName === 'first.png'
              ? '![first.png](https://github.com/user-attachments/first)'
              : '[second.txt](https://github.com/user-attachments/second)',
        })),
      ),
    };

    const response = await handleAttachmentUpload(
      uploadContext(uploadAttachment.uploadAttachment),
      {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        files: [
          { fileName: 'first.png', contentBase64: 'AQI=' },
          { fileName: 'second.txt', contentBase64: 'AwQ=' },
        ],
      },
    );

    expect(response).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        results: [
          {
            fileName: 'first.png',
            status: 'uploaded',
            markdown: '![first.png](https://github.com/user-attachments/first)',
          },
          {
            fileName: 'second.txt',
            status: 'uploaded',
            markdown:
              '[second.txt](https://github.com/user-attachments/second)',
          },
        ],
      },
    });
    expect(uploadAttachment.uploadAttachment).toHaveBeenCalledTimes(1);
    expect(uploadAttachment.uploadAttachment).toHaveBeenCalledWith({
      issueOrPullRequestUrl: 'https://github.com/o/r/issues/1',
      files: [
        { fileName: 'first.png', content: new Uint8Array([1, 2]) },
        { fileName: 'second.txt', content: new Uint8Array([3, 4]) },
      ],
    });
  });

  it('returns success and failure results for all files without stopping after one failure', async () => {
    const response = await handleAttachmentUpload(
      uploadContext(async (request) =>
        request.files.map((file) =>
          file.fileName === 'first.png'
            ? {
                fileName: file.fileName,
                status: 'uploaded' as const,
                markdown:
                  '![first.png](https://github.com/user-attachments/first)',
              }
            : file.fileName === 'broken.png'
              ? {
                  fileName: file.fileName,
                  status: 'failed' as const,
                  error: 'upload failed',
                }
              : {
                  fileName: file.fileName,
                  status: 'failed' as const,
                  error: 'command stderr',
                },
        ),
      ),
      {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        files: [
          { fileName: 'first.png', contentBase64: 'AQI=' },
          { fileName: 'broken.png', contentBase64: 'AwQ=' },
          { fileName: 'last.png', contentBase64: 'BQY=' },
        ],
      },
    );

    expect(response).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        results: [
          {
            fileName: 'first.png',
            status: 'uploaded',
            markdown: '![first.png](https://github.com/user-attachments/first)',
          },
          {
            fileName: 'broken.png',
            status: 'failed',
            error: 'upload failed',
          },
          {
            fileName: 'last.png',
            status: 'failed',
            error: 'command stderr',
          },
        ],
      },
    });
  });

  it('returns a timeout failure for each file not reported by the server backstop', async () => {
    const response = await handleAttachmentUpload(
      uploadContext(async (request) =>
        request.files.map((file) => ({
          fileName: file.fileName,
          status: 'failed' as const,
          error: 'upload timed out',
        })),
      ),
      {
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        files: [
          { fileName: 'waiting.png', contentBase64: 'AQI=' },
          { fileName: 'also-waiting.png', contentBase64: 'AwQ=' },
        ],
      },
    );

    expect(response).toEqual({
      statusCode: 200,
      body: {
        ok: true,
        results: [
          {
            fileName: 'waiting.png',
            status: 'failed',
            error: 'upload timed out',
          },
          {
            fileName: 'also-waiting.png',
            status: 'failed',
            error: 'upload timed out',
          },
        ],
      },
    });
  });
});
