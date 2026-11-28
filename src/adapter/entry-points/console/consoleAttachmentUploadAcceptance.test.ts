import type { ConsoleOperationContext } from './consoleOperationApi';
import { handleAttachmentUpload } from './consoleOperationApi';

const uploadContext = (
  uploadAttachment: ConsoleOperationContext['issueAttachmentRepository'],
): ConsoleOperationContext => ({
  resolveIssueRepository: () => {
    throw new Error('issue repository is not used by attachment upload');
  },
  resolveProject: async () => null,
  isPjcodeConfigured: () => true,
  consoleDataOutputDir: null,
  issueAttachmentRepository: uploadAttachment,
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
      uploadAttachment: jest.fn(
        async () => '![unused](https://example.test/u)',
      ),
    };

    const response = await handleAttachmentUpload(
      uploadContext(uploadAttachment),
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
  });

  it('returns success and failure results for all files without stopping after one failure', async () => {
    const response = await handleAttachmentUpload(
      uploadContext({
        uploadAttachment: jest.fn(),
      }),
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

  it('returns a timeout failure for each file not reported before 300000 ms', async () => {
    const response = await handleAttachmentUpload(
      uploadContext({
        uploadAttachment: jest.fn(),
      }),
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
