import { act, renderHook } from '@testing-library/react';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
} from '../testing/fixtures';
import { ConsoleOperationRejectedError } from '../lib/consoleApi';
import { ConsoleActionPartiallySentError } from './useConsoleActionQueue';
import { useConsoleOperations } from './useConsoleOperations';
import { useConsoleOverlay } from './useConsoleOverlay';

const STALE_STATUS_MESSAGE =
  'Status changed since this action was queued: expected "Todo" but the issue\'s Status is now "Done".';

const rejectTriageWith = (responseBody: Record<string, unknown>): jest.Mock => {
  const fetchMock = jest.fn(async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify(responseBody),
    json: async () => responseBody,
  }));
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe('useConsoleOperations move to Awaiting Workspace rejection', () => {
  it('surfaces an HTTP 200 that reports commentPosted false as a typed refusal', async () => {
    const responseBody = {
      ok: false,
      commentPosted: false,
      statusSet: true,
      error: 'comment failed',
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(responseBody),
      json: async () => responseBody,
    })) as unknown as typeof fetch;
    const { result } = renderHook(() => {
      const overlay = useConsoleOverlay('acme');
      const operations = useConsoleOperations('acme');
      return { overlay, operations };
    });
    const [item] = consoleListItemsFixture;
    const [option] = consoleStatusOptionsFixture.filter(
      (candidate) => candidate.name.toLowerCase() === 'awaiting workspace',
    );

    const error: unknown = await act(async () =>
      result.current.operations
        .addCommentAndMoveToAwaitingWorkspace(item, 'handoff details', option)
        .then(
          () => undefined,
          (cause: unknown) => cause,
        ),
    );

    expect(error).toBeInstanceOf(ConsoleOperationRejectedError);
    expect((error as ConsoleOperationRejectedError).commentPosted).toBe(false);
  });
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/projects/acme/prs?k=token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it.each([
    [
      'the comment was posted before the status change was refused',
      true,
      ConsoleActionPartiallySentError,
    ],
    ['the comment was not posted', false, Error],
  ])(
    'surfaces a rejected move as a partial send only when %s',
    async (_name, commentPosted, expectedErrorClass) => {
      rejectTriageWith({ error: STALE_STATUS_MESSAGE, commentPosted });
      const { result } = renderHook(() => {
        const overlay = useConsoleOverlay('acme');
        const operations = useConsoleOperations('acme');
        return { overlay, operations };
      });
      const [item] = consoleListItemsFixture;
      const [option] = consoleStatusOptionsFixture.filter(
        (candidate) => candidate.name.toLowerCase() === 'awaiting workspace',
      );

      const error: unknown = await act(async () =>
        result.current.operations
          .addCommentAndMoveToAwaitingWorkspace(item, 'handoff details', option)
          .then(
            () => undefined,
            (cause: unknown) => cause,
          ),
      );

      expect(error).toBeInstanceOf(expectedErrorClass);
      if (commentPosted) {
        expect((error as ConsoleActionPartiallySentError).sentStepCount).toBe(
          1,
        );
      }
    },
  );
});
