import {
  createConsoleApiClient,
  postConsoleOperation,
  postConsoleReviewComment,
} from './consoleApi';

const mockFetchOnce = (body: unknown, ok = true): jest.Mock => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const mockFetchFailureOnce = (status: number, rawBody: string): jest.Mock => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status,
    text: async () => rawBody,
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe('createConsoleApiClient', () => {
  it('reads the item body from the api root without a token query', async () => {
    const fetchMock = mockFetchOnce({ body: '# Title' });
    const client = createConsoleApiClient();
    const body = await client.fetchItemBody('https://github.com/o/r/issues/1');
    expect(body).toBe('# Title');
    const requested = fetchMock.mock.calls[0][0] as string;
    expect(requested).toContain('/api/itembody?url=');
    expect(requested).not.toContain('k=');
  });

  it('anchors every read endpoint at the server root regardless of route', async () => {
    const readers: ((url: string) => Promise<unknown>)[] = [];
    const client = createConsoleApiClient();
    readers.push((url) => client.fetchItemBody(url));
    readers.push((url) => client.fetchComments(url));
    readers.push((url) => client.fetchPrFiles(url));
    readers.push((url) => client.fetchPrCommits(url));
    readers.push((url) => client.fetchRelatedPrs(url));
    readers.push((url) => client.fetchIssueState(url));
    readers.push((url) => client.fetchPullRequestStatus(url));
    const expectedPaths = [
      '/api/itembody',
      '/api/comments',
      '/api/prfiles',
      '/api/prcommits',
      '/api/relatedprs',
      '/api/issuetitle',
      '/api/pullrequeststatus',
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
    const client = createConsoleApiClient();
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
    const client = createConsoleApiClient();
    const files = await client.fetchPrFiles('https://github.com/o/r/pull/1');
    expect(files.map((file) => file.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('returns no files when the response files array is null', async () => {
    mockFetchOnce({ files: null });
    const client = createConsoleApiClient();
    expect(await client.fetchPrFiles('https://github.com/o/r/pull/1')).toEqual(
      [],
    );
  });

  it('parses the issue state', async () => {
    mockFetchOnce({
      state: 'closed',
      merged: true,
      isPullRequest: true,
      title: 'Decorate PR links',
    });
    const client = createConsoleApiClient();
    expect(
      await client.fetchIssueState('https://github.com/o/r/pull/1'),
    ).toEqual({
      state: 'closed',
      merged: true,
      isPullRequest: true,
      title: 'Decorate PR links',
    });
  });

  it('defaults the title to an empty string when absent', async () => {
    mockFetchOnce({ state: 'open', merged: false, isPullRequest: false });
    const client = createConsoleApiClient();
    expect(
      await client.fetchIssueState('https://github.com/o/r/issues/1'),
    ).toEqual({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: '',
    });
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
    const client = createConsoleApiClient();
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
    const client = createConsoleApiClient();
    const related = await client.fetchRelatedPrs(
      'https://github.com/o/r/issues/1',
    );
    expect(related[0].url).toBe('https://github.com/o/r/pull/9');
    expect(related[0].summary?.changedFiles).toBe(3);
    expect(related[0].missingRequiredCheckNames).toEqual(['build']);
  });

  it('parses the pull request status when found', async () => {
    mockFetchOnce({
      found: true,
      status: {
        isConflicted: true,
        mergeableStatus: 'CONFLICTING',
        isPassedAllCiJob: false,
        isCiStateSuccess: false,
        isBranchOutOfDate: true,
        missingRequiredCheckNames: ['build', 'test'],
      },
    });
    const client = createConsoleApiClient();
    expect(
      await client.fetchPullRequestStatus('https://github.com/o/r/pull/1'),
    ).toEqual({
      found: true,
      isConflicted: true,
      mergeableStatus: 'CONFLICTING',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: true,
      missingRequiredCheckNames: ['build', 'test'],
    });
  });

  it('defaults the mergeable status to unknown when the server omits it', async () => {
    mockFetchOnce({
      found: true,
      status: {
        isConflicted: false,
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
    });
    const client = createConsoleApiClient();
    const status = await client.fetchPullRequestStatus(
      'https://github.com/o/r/pull/1',
    );
    expect(status.mergeableStatus).toBe('UNKNOWN');
  });

  it('returns a not-found pull request status when the server reports none', async () => {
    mockFetchOnce({ found: false, status: null });
    const client = createConsoleApiClient();
    expect(
      await client.fetchPullRequestStatus('https://github.com/o/r/pull/1'),
    ).toEqual({
      found: false,
      isConflicted: false,
      mergeableStatus: 'UNKNOWN',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });
  });

  it('throws on a non-ok response', async () => {
    mockFetchOnce({}, false);
    const client = createConsoleApiClient();
    await expect(
      client.fetchComments('https://github.com/o/r/issues/1'),
    ).rejects.toThrow('HTTP 500');
  });
});

describe('postConsoleOperation', () => {
  it('posts a JSON body to the operation endpoint', async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    await postConsoleOperation('/api/review', {
      pjcode: 'umino',
      action: 'approve',
      prUrl: 'https://github.com/o/r/pull/1',
      projectItemId: 'PVTI_1',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/review');
    expect(init).toMatchObject({ method: 'POST' });
  });

  const failingReview = (): Promise<void> =>
    postConsoleOperation('/api/review', {
      pjcode: 'umino',
      action: 'approve',
      prUrl: 'https://github.com/o/r/pull/1',
      projectItemId: 'PVTI_1',
    });

  it('throws the error reason from a JSON error body', async () => {
    mockFetchFailureOnce(
      502,
      JSON.stringify({ error: 'Failed to approve PR: HTTP 422' }),
    );
    await expect(failingReview()).rejects.toThrow(
      'Failed to approve PR: HTTP 422',
    );
  });

  it('throws the raw body when the error body is not JSON', async () => {
    mockFetchFailureOnce(500, 'Internal Server Error');
    await expect(failingReview()).rejects.toThrow('Internal Server Error');
  });

  it('falls back to the status code when the error body is empty', async () => {
    mockFetchFailureOnce(500, '');
    await expect(failingReview()).rejects.toThrow('HTTP 500');
  });
});

describe('postConsoleReviewComment', () => {
  it('posts the inline review comment body to the reviewcomment endpoint', async () => {
    const fetchMock = mockFetchOnce({ ok: true });
    await postConsoleReviewComment({
      pjcode: 'umino',
      url: 'https://github.com/o/r/pull/1',
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT',
      body: 'Consider extracting this into a helper.',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/reviewcomment');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse((init as { body: string }).body)).toEqual({
      pjcode: 'umino',
      url: 'https://github.com/o/r/pull/1',
      path: 'src/index.ts',
      line: 42,
      side: 'RIGHT',
      body: 'Consider extracting this into a helper.',
    });
  });

  it('throws the GitHub error reason surfaced by the server', async () => {
    mockFetchFailureOnce(
      502,
      JSON.stringify({
        error:
          'Failed to create review comment on PR https://github.com/o/r/pull/1: line must be part of the diff',
      }),
    );
    await expect(
      postConsoleReviewComment({
        pjcode: 'umino',
        url: 'https://github.com/o/r/pull/1',
        path: 'src/index.ts',
        line: 42,
        side: 'RIGHT',
        body: 'Consider extracting this into a helper.',
      }),
    ).rejects.toThrow('line must be part of the diff');
  });
});
