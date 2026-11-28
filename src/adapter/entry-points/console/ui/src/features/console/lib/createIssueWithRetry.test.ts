import type { ConsoleCreateIssueRequest } from './consoleApi';
import {
  CREATE_ISSUE_MAX_ATTEMPTS,
  CREATE_ISSUE_RETRY_DELAYS_MS,
  type CreateIssueOutcome,
  createIssueWithRetry,
} from './createIssueWithRetry';

const request: ConsoleCreateIssueRequest & { actionId: string } = {
  pjcode: 'acme',
  title: 'Retryable task',
  storyName: 'TDPM Console port',
  nameWithOwner: 'acme-labs/portal',
  actionId: 'action-123',
};

const response = (httpStatus: number, body: unknown) => ({
  httpStatus,
  body,
});

describe('createIssueWithRetry', () => {
  it('returns the created issue from a successful response without retrying', async () => {
    const send = jest.fn().mockResolvedValue(
      response(200, {
        ok: true,
        issueUrl: 'https://github.com/acme-labs/portal/issues/42',
      }),
    );

    await expect(createIssueWithRetry(send, request)).resolves.toEqual({
      kind: 'created',
      issueUrl: 'https://github.com/acme-labs/portal/issues/42',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: 'not created response',
      responses: [
        response(500, {
          ok: false,
          issueCreated: false,
          error: 'create failed',
        }),
        response(200, {
          ok: true,
          issueUrl: 'https://github.com/acme-labs/portal/issues/42',
        }),
      ],
      expected: {
        kind: 'created',
        issueUrl: 'https://github.com/acme-labs/portal/issues/42',
      },
    },
    {
      name: 'created incomplete step response',
      responses: [
        response(500, {
          ok: false,
          issueCreated: true,
          issueUrl: 'https://github.com/acme-labs/portal/issues/42',
          failedStep: 'addIssueToProject',
          error: 'project unavailable',
        }),
        response(200, {
          ok: true,
          issueUrl: 'https://github.com/acme-labs/portal/issues/42',
        }),
      ],
      expected: {
        kind: 'created',
        issueUrl: 'https://github.com/acme-labs/portal/issues/42',
      },
    },
  ])('$name retries with the same request and actionId', async (testCase) => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(testCase.responses[0])
      .mockResolvedValueOnce(testCase.responses[1]);
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      createIssueWithRetry(send, request, { wait }),
    ).resolves.toEqual(testCase.expected);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toEqual(request);
    expect(send.mock.calls[1][0]).toEqual(request);
    expect(wait).toHaveBeenCalledWith(CREATE_ISSUE_RETRY_DELAYS_MS[0]);
  });

  it('returns createdWithIncompleteStep after exhausting retries for an already-created issue', async () => {
    const send = jest.fn().mockResolvedValue(
      response(500, {
        ok: false,
        issueCreated: true,
        issueUrl: 'https://github.com/acme-labs/portal/issues/42',
        failedStep: 'updateStory',
        error: 'story update failed',
      }),
    );
    const wait = jest.fn().mockResolvedValue(undefined);

    const outcome = await createIssueWithRetry(send, request, { wait });

    expect(outcome).toEqual({
      kind: 'createdWithIncompleteStep',
      issueUrl: 'https://github.com/acme-labs/portal/issues/42',
      failedStep: 'updateStory',
      reason: expect.stringContaining('story update failed'),
    });
    expect(send).toHaveBeenCalledTimes(CREATE_ISSUE_MAX_ATTEMPTS);
    expect(wait.mock.calls.map(([delay]) => delay)).toEqual([
      CREATE_ISSUE_RETRY_DELAYS_MS[0],
      CREATE_ISSUE_RETRY_DELAYS_MS[1],
    ]);
  });

  it('returns notCreated after exhausting issue-not-created responses', async () => {
    const send = jest.fn().mockResolvedValue(
      response(500, {
        ok: false,
        issueCreated: false,
        error: 'still failed',
      }),
    );
    const wait = jest.fn().mockResolvedValue(undefined);

    const outcome = await createIssueWithRetry(send, request, { wait });

    expect(outcome).toEqual({
      kind: 'notCreated',
      reason: expect.stringContaining('still failed'),
    });
    expect(send).toHaveBeenCalledTimes(CREATE_ISSUE_MAX_ATTEMPTS);
  });

  it.each([
    { name: 'network error', error: new Error('network down') },
    { name: 'timeout', error: new Error('request timed out') },
  ])('returns unconfirmed after $name on every attempt', async ({ error }) => {
    const send = jest.fn().mockRejectedValue(error);
    const wait = jest.fn().mockResolvedValue(undefined);

    const outcome = await createIssueWithRetry(send, request, { wait });

    expect(outcome).toEqual({
      kind: 'unconfirmed',
      reason: expect.stringContaining(error.message),
    });
    expect(send).toHaveBeenCalledTimes(CREATE_ISSUE_MAX_ATTEMPTS);
  });

  it('uses the most recent response when a later transport attempt throws', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(
        response(500, { ok: false, issueCreated: false, error: 'not found' }),
      )
      .mockRejectedValueOnce(new Error('lost response'))
      .mockRejectedValueOnce(new Error('lost response again'));
    const wait = jest.fn().mockResolvedValue(undefined);

    const outcome = await createIssueWithRetry(send, request, { wait });

    expect(outcome.kind).toBe('unconfirmed');
    expect(
      (outcome as Extract<CreateIssueOutcome, { kind: 'unconfirmed' }>).reason,
    ).toContain('lost response again');
  });

  it('returns unconfirmed when a not-created response is followed by transport failures', async () => {
    const send = jest
      .fn()
      .mockResolvedValueOnce(
        response(500, { ok: false, issueCreated: false, error: 'e' }),
      )
      .mockRejectedValueOnce(new Error('lost response'))
      .mockRejectedValueOnce(new Error('lost response again'));
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      createIssueWithRetry(send, request, { wait }),
    ).resolves.toEqual(expect.objectContaining({ kind: 'unconfirmed' }));
  });

  it('does not retry a non-retryable client error and includes its error', async () => {
    const send = jest
      .fn()
      .mockResolvedValue(response(422, { ok: false, error: 'invalid story' }));

    await expect(createIssueWithRetry(send, request)).resolves.toEqual({
      kind: 'notCreated',
      reason: expect.stringContaining('invalid story'),
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it.each([500, 502])(
    'retries an unknown server error until the issue state is unconfirmed (%s)',
    async (httpStatus) => {
      const send = jest.fn().mockResolvedValue(
        response(httpStatus, {
          ok: false,
          error: 'upstream unavailable',
        }),
      );
      const wait = jest.fn().mockResolvedValue(undefined);

      const outcome = await createIssueWithRetry(send, request, { wait });

      expect(outcome).toEqual({
        kind: 'unconfirmed',
        reason: expect.stringContaining('upstream unavailable'),
      });
      expect(send).toHaveBeenCalledTimes(CREATE_ISSUE_MAX_ATTEMPTS);
      expect(send.mock.calls.map(([sentRequest]) => sentRequest)).toEqual(
        Array(CREATE_ISSUE_MAX_ATTEMPTS).fill(request),
      );
    },
  );

  it('returns the created issue after an unknown server error is followed by success', async () => {
    const issueUrl = 'https://github.com/acme-labs/portal/issues/42';
    const send = jest
      .fn()
      .mockResolvedValueOnce(
        response(502, {
          ok: false,
          error: 'upstream unavailable',
        }),
      )
      .mockResolvedValueOnce(response(201, { ok: true, issueUrl }));
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      createIssueWithRetry(send, request, { wait }),
    ).resolves.toEqual({ kind: 'created', issueUrl });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toEqual(request);
    expect(send.mock.calls[1][0]).toEqual(request);
  });
});
