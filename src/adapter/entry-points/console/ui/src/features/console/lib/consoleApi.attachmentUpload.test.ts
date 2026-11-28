import { postConsoleAttachment } from './consoleApi';

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
