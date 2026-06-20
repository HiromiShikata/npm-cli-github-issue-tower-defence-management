import { createConsoleApiClient, postConsoleOperation } from './consoleApi';

const appendToken = (url: string): string =>
  url.includes('?') ? `${url}&k=token` : `${url}?k=token`;

const mockFetchOnce = (body: unknown, ok = true): jest.Mock => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe('createConsoleApiClient', () => {
  it('reads the item body and appends the token to the url query', async () => {
    const fetchMock = mockFetchOnce({ body: '# Title' });
    const client = createConsoleApiClient(appendToken);
    const body = await client.fetchItemBody('https://github.com/o/r/issues/1');
    expect(body).toBe('# Title');
    const requested = fetchMock.mock.calls[0][0] as string;
    expect(requested).toContain('/api/itembody?url=');
    expect(requested).toContain('&k=token');
  });

  it('anchors every read endpoint at the server root regardless of route', async () => {
    const readers: ((url: string) => Promise<unknown>)[] = [];
    const client = createConsoleApiClient(appendToken);
    readers.push((url) => client.fetchItemBody(url));
    readers.push((url) => client.fetchComments(url));
    readers.push((url) => client.fetchPrFiles(url));
    readers.push((url) => client.fetchPrCommits(url));
    readers.push((url) => client.fetchRelatedPrs(url));
    readers.push((url) => client.fetchIssueState(url));
    const expectedPaths = [
      '/api/itembody',
      '/api/comments',
      '/api/prfiles',
      '/api/prcommits',
      '/api/relatedprs',
      '/api/issuetitle',
    ];
    for (let index = 0; index < readers.length; index += 1) {
      const fetchMock = mockFetchOnce({});
      await readers[index]('https://github.com/o/r/issues/1');
      const requested = fetchMock.mock.calls[0][0] as string;
      expect(requested.startsWith(expectedPaths[index])).toBe(true);
      expect(requested.startsWith('/api/')).toBe(true);
      expect(requested.startsWith('./')).toBe(false);
      expect(requested.startsWith('/projects')).toBe(false);
    }
  });

  it('parses comments', async () => {
    mockFetchOnce({
      comments: [
        { author: 'a', body: 'hello', createdAt: '2026-06-19T00:00:00.000Z' },
      ],
    });
    const client = createConsoleApiClient(appendToken);
    const comments = await client.fetchComments(
      'https://github.com/o/r/issues/1',
    );
    expect(comments).toEqual([
      { author: 'a', body: 'hello', createdAt: '2026-06-19T00:00:00.000Z' },
    ]);
  });

  it('parses changed files supporting path and filename keys', async () => {
    mockFetchOnce({
      files: [
        { path: 'a.ts', additions: 3, deletions: 1, status: 'modified' },
        { filename: 'b.ts', additions: 9, deletions: 0, status: 'added' },
      ],
    });
    const client = createConsoleApiClient(appendToken);
    const files = await client.fetchPrFiles('https://github.com/o/r/pull/1');
    expect(files.map((file) => file.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('returns no files when the response files array is null', async () => {
    mockFetchOnce({ files: null });
    const client = createConsoleApiClient(appendToken);
    expect(await client.fetchPrFiles('https://github.com/o/r/pull/1')).toEqual(
      [],
    );
  });

  it('parses the issue state', async () => {
    mockFetchOnce({ state: 'closed', merged: true, isPullRequest: true });
    const client = createConsoleApiClient(appendToken);
    expect(
      await client.fetchIssueState('https://github.com/o/r/pull/1'),
    ).toEqual({ state: 'closed', merged: true, isPullRequest: true });
  });

  it('parses pull request commits', async () => {
    mockFetchOnce({
      commits: [
        {
          sha: 'abc1234',
          message: 'fix: thing',
          author: 'dev',
          authoredAt: '2026-06-19T00:00:00.000Z',
        },
      ],
    });
    const client = createConsoleApiClient(appendToken);
    const commits = await client.fetchPrCommits(
      'https://github.com/o/r/pull/1',
    );
    expect(commits[0].sha).toBe('abc1234');
  });

  it('parses related pull requests with summaries', async () => {
    mockFetchOnce({
      relatedPullRequests: [
        {
          url: 'https://github.com/o/r/pull/9',
          branchName: 'feat',
          createdAt: '2026-06-19T00:00:00.000Z',
          isDraft: false,
          isConflicted: false,
          isPassedAllCiJob: true,
          isCiStateSuccess: true,
          isResolvedAllReviewComments: true,
          isBranchOutOfDate: false,
          missingRequiredCheckNames: ['build'],
          summary: {
            title: 'Linked',
            body: 'body',
            additions: 10,
            deletions: 2,
            changedFiles: 3,
          },
        },
      ],
    });
    const client = createConsoleApiClient(appendToken);
    const related = await client.fetchRelatedPrs(
      'https://github.com/o/r/issues/1',
    );
    expect(related[0].url).toBe('https://github.com/o/r/pull/9');
    expect(related[0].summary?.changedFiles).toBe(3);
    expect(related[0].missingRequiredCheckNames).toEqual(['build']);
  });

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false);
    const client = createConsoleApiClient(appendToken);
    await expect(
      client.fetchComments('https://github.com/o/r/issues/1'),
    ).rejects.toThrow('HTTP 500');
  });
});

describe('postConsoleOperation', () => {
  it('posts a JSON body and appends the token', async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    await postConsoleOperation(appendToken, '/api/review', {
      pjcode: 'umino',
      action: 'approve',
      prUrl: 'https://github.com/o/r/pull/1',
      projectItemId: 'PVTI_1',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/review?k=token');
    expect(init).toMatchObject({ method: 'POST' });
  });

  it('throws on a failed operation', async () => {
    mockFetchOnce({}, false);
    await expect(
      postConsoleOperation(appendToken, '/api/review', {
        pjcode: 'umino',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/1',
        projectItemId: 'PVTI_1',
      }),
    ).rejects.toThrow('HTTP 500');
  });
});
