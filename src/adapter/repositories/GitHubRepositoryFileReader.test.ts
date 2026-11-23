import { GitHubRepositoryFileReader } from './GitHubRepositoryFileReader';

const responseWithStatus = (status: number, body: string): Response =>
  new Response(body, { status });

const createReader = (fetchImplementation: jest.MockedFunction<typeof fetch>) =>
  new GitHubRepositoryFileReader(
    fetchImplementation,
    (owner) => `token-${owner}`,
  );

describe('GitHubRepositoryFileReader.readFile', () => {
  it('requests the raw contents URL with each path segment and the ref URL-encoded', async () => {
    const cases = [
      {
        owner: 'HiromiShikata',
        repo: 'example',
        ref: 'main',
        path: 'docs/readme.md',
        expectedUrl:
          'https://api.github.com/repos/HiromiShikata/example/contents/docs/readme.md?ref=main',
      },
      {
        owner: 'HiromiShikata',
        repo: 'example',
        ref: 'feature/x y',
        path: 'docs/a b.md',
        expectedUrl:
          'https://api.github.com/repos/HiromiShikata/example/contents/docs/a%20b.md?ref=feature%2Fx%20y',
      },
      {
        owner: 'HiromiShikata',
        repo: 'example',
        ref: 'v1+2',
        path: 'a#b/c?d.md',
        expectedUrl:
          'https://api.github.com/repos/HiromiShikata/example/contents/a%23b/c%3Fd.md?ref=v1%2B2',
      },
    ];

    for (const testCase of cases) {
      const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
      fetchImplementation.mockResolvedValue(responseWithStatus(200, 'content'));
      const reader = createReader(fetchImplementation);

      await reader.readFile(
        testCase.owner,
        testCase.repo,
        testCase.ref,
        testCase.path,
      );

      expect(fetchImplementation).toHaveBeenCalledTimes(1);
      const [url, init] = fetchImplementation.mock.calls[0];
      expect({ url, method: init?.method }).toEqual({
        url: testCase.expectedUrl,
        method: 'GET',
      });
    }
  });

  it('sends the raw accept header and the bearer token resolved for the owner', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(responseWithStatus(200, 'content'));
    const reader = createReader(fetchImplementation);

    await reader.readFile('HiromiShikata', 'example', 'main', 'docs/readme.md');

    const [, init] = fetchImplementation.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Accept: 'application/vnd.github.raw',
      Authorization: 'Bearer token-HiromiShikata',
    });
  });

  it('resolves to the body text for a 200 response', async () => {
    const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
    fetchImplementation.mockResolvedValue(
      responseWithStatus(200, '# 見出し\n本文'),
    );
    const reader = createReader(fetchImplementation);

    await expect(
      reader.readFile('HiromiShikata', 'example', 'main', 'docs/readme.md'),
    ).resolves.toBe('# 見出し\n本文');
  });

  it('rejects with the failure reason for each non-OK status', async () => {
    const cases = [
      { status: 404, messagePart: 'file_not_found' },
      { status: 403, messagePart: '403' },
      { status: 500, messagePart: '500' },
    ];

    for (const testCase of cases) {
      const fetchImplementation: jest.MockedFunction<typeof fetch> = jest.fn();
      fetchImplementation.mockResolvedValue(
        responseWithStatus(testCase.status, 'error body'),
      );
      const reader = createReader(fetchImplementation);

      await expect(
        reader.readFile('HiromiShikata', 'example', 'main', 'docs/readme.md'),
      ).rejects.toThrow(testCase.messagePart);
    }
  });
});
