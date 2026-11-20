import {
  ConsoleOperationRejectedError,
  postConsoleOperation,
} from './consoleApi';

const STALE_STATUS_MESSAGE =
  'Status changed since this action was queued: expected "Todo" but the issue\'s Status is now "Done".';

const rejectWith = (responseBody: Record<string, unknown>) =>
  jest.fn(async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify(responseBody),
    json: async () => responseBody,
  })) as unknown as typeof fetch;

describe('postConsoleOperation rejection', () => {
  afterEach(() => {
    global.fetch = undefined as unknown as typeof fetch;
  });

  it.each([
    ['reports that the comment was posted', { commentPosted: true }, true],
    [
      'reports that the comment was not posted',
      { commentPosted: false },
      false,
    ],
    ['reports no comment state', {}, null],
  ])(
    'throws a typed rejection that %s',
    async (_name, extraBody, expectedCommentPosted) => {
      global.fetch = rejectWith({ error: STALE_STATUS_MESSAGE, ...extraBody });

      const error: unknown = await postConsoleOperation('/api/triage', {}).then(
        () => undefined,
        (cause: unknown) => cause,
      );

      expect(error).toBeInstanceOf(ConsoleOperationRejectedError);
      expect((error as ConsoleOperationRejectedError).message).toBe(
        STALE_STATUS_MESSAGE,
      );
      expect((error as ConsoleOperationRejectedError).commentPosted).toBe(
        expectedCommentPosted,
      );
    },
  );
});
