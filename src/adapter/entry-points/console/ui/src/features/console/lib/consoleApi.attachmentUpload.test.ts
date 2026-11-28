import {
  attachmentMarkdownFromResult,
  postConsoleAttachment,
} from './consoleApi';

describe('attachmentMarkdownFromResult', () => {
  it('returns the markdown link of a single uploaded file from the batch results', () => {
    expect(
      attachmentMarkdownFromResult(
        JSON.stringify([
          {
            fileName: 'A.png',
            status: 'uploaded',
            markdown: '![A.png](https://example.com/A.png)',
          },
        ]),
      ),
    ).toBe('![A.png](https://example.com/A.png)');
  });

  it('throws the error text of a single file that failed to upload', () => {
    expect(() =>
      attachmentMarkdownFromResult(
        JSON.stringify([
          {
            fileName: 'A.png',
            status: 'failed',
            error: 'distinctive helper failure reason',
          },
        ]),
      ),
    ).toThrow(new Error('distinctive helper failure reason'));
  });

  it('returns a non-JSON markdown string unchanged', () => {
    expect(
      attachmentMarkdownFromResult('![B.png](https://example.com/B.png)'),
    ).toBe('![B.png](https://example.com/B.png)');
  });

  it('uses the real single-file upload request end to end', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            ok: true,
            results: [
              {
                fileName: 'C.png',
                status: 'uploaded',
                markdown: '![C.png](https://example.com/C.png)',
              },
            ],
          }),
        }) as Response,
    );
    try {
      const rawResult = await postConsoleAttachment({
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        fileName: 'C.png',
        contentBase64: 'AAAA',
      });

      expect(attachmentMarkdownFromResult(rawResult)).toBe(
        '![C.png](https://example.com/C.png)',
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('postConsoleAttachment', () => {
  it('does not abort an upload request at 300000 ms', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      async (
        _input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('upload request aborted'));
          });
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const uploadPromise = postConsoleAttachment({
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        fileName: 'slow.png',
        contentBase64: 'AQI=',
      });
      void uploadPromise.catch(() => undefined);

      await jest.advanceTimersByTimeAsync(300000);

      const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(requestInit.signal?.aborted).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
      jest.useRealTimers();
    }
  });

  it('aborts an upload request at 360000 ms', async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn(
      async (
        _input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('upload request aborted'));
          });
        }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;
    try {
      const uploadPromise = postConsoleAttachment({
        pjcode: 'acme',
        url: 'https://github.com/o/r/issues/1',
        fileName: 'slow.png',
        contentBase64: 'AQI=',
      });
      void uploadPromise.catch(() => undefined);

      await jest.advanceTimersByTimeAsync(360000);

      const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(requestInit.signal?.aborted).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      jest.useRealTimers();
    }
  });
});
