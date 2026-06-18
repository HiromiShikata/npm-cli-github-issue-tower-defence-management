import { createConsoleApiClient } from './consoleApiClient';

const appendToken = (url: string): string =>
  `${url}${url.includes('?') ? '&' : '?'}k=secret-token`;

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('createConsoleApiClient', () => {
  it('appends the access token to read requests', async () => {
    const fetchImpl = jest.fn(async (_url: string) =>
      jsonResponse({ body: 'hello', comments: [], labels: [] }),
    );
    const client = createConsoleApiClient({
      pjcode: 'tdpm',
      appendToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.fetchItemBody('owner/repo', 42);
    const requestedUrl = fetchImpl.mock.calls[0][0] as string;
    expect(requestedUrl).toContain('/api/itembody');
    expect(requestedUrl).toContain('k=secret-token');
    expect(requestedUrl).toContain('number=42');
  });

  it('normalizes the item body payload', async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse({
        body: 'content',
        labels: ['claude'],
        createdAt: '2026-06-18T00:00:00.000Z',
        comments: [{ author: 'a', body: 'b', createdAt: 'c' }],
        state: 'closed',
        stateReason: 'not_planned',
      }),
    );
    const client = createConsoleApiClient({
      pjcode: 'tdpm',
      appendToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const body = await client.fetchItemBody('owner/repo', 1);
    expect(body.state).toBe('closed');
    expect(body.stateReason).toBe('not_planned');
    expect(body.comments).toHaveLength(1);
  });

  it('throws on a non-ok response', async () => {
    const fetchImpl = jest.fn(
      async () => new Response('nope', { status: 403 }),
    );
    const client = createConsoleApiClient({
      pjcode: 'tdpm',
      appendToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.fetchComments('owner/repo', 1)).rejects.toThrow(
      'HTTP 403',
    );
  });

  it('posts a review payload to the review endpoint', async () => {
    const fetchImpl = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(null, { status: 200 }),
    );
    const client = createConsoleApiClient({
      pjcode: 'tdpm',
      appendToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.postReview({ repo: 'owner/repo', number: 9 }, 'APPROVE');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url as string).toContain('/api/review');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      repo: 'owner/repo',
      pr: 9,
      event: 'APPROVE',
    });
  });

  it('posts an in-tmux registration to the intmux endpoint', async () => {
    const fetchImpl = jest.fn(
      async (_url: string, _init: RequestInit) =>
        new Response(null, { status: 200 }),
    );
    const client = createConsoleApiClient({
      pjcode: 'tdpm',
      appendToken,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.postInTmux('item-id', 'https://example.com', 'Title', 'Story');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url as string).toContain('/api/intmux');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      projectItemId: 'item-id',
      title: 'Title',
      story: 'Story',
    });
  });
});
