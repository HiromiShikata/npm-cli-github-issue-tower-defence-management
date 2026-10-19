const mockCheckSecondaryRateLimitBreaker = jest.fn(
  (): { isBlocked: boolean; resetTimeMs: number | null } => ({
    isBlocked: false,
    resetTimeMs: null,
  }),
);
const mockWriteSecondaryRateLimitState = jest.fn();

jest.mock('./issue/githubSecondaryRateLimitBreaker', () => ({
  checkSecondaryRateLimitBreaker: mockCheckSecondaryRateLimitBreaker,
  writeSecondaryRateLimitState: mockWriteSecondaryRateLimitState,
  secondaryRateLimitStateFilePath: () =>
    '/tmp/test-comment-repo-cache-type-breaker-state.json',
}));

import { GitHubIssueCommentRepository } from './GitHubIssueCommentRepository';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
import { LocalStorageRepository } from './LocalStorageRepository';
import { Issue } from '../../domain/entities/Issue';

type AcceptedCommentCacheRepository = NonNullable<
  ConstructorParameters<typeof GitHubIssueCommentRepository>[1]
>;

type LiteralCommentCacheRepository = Pick<
  LocalStorageCacheRepository,
  'getSingle' | 'setSingle' | 'withLock'
>;

const acceptedCacheAsLiteralPick = (
  cache: AcceptedCommentCacheRepository,
): LiteralCommentCacheRepository => cache;

const TEST_URL = 'https://github.com/HiromiShikata/test-repo/issues/123';
const EXPECTED_REST_URL =
  'https://api.github.com/repos/HiromiShikata/test-repo/issues/123/comments?per_page=100&page=1';

const buildIssue = (url: string): Issue => ({
  url,
  nameWithOwner: 'HiromiShikata/test-repo',
  number: 123,
  title: 'Test Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  assignees: [],
  labels: [],
  org: 'HiromiShikata',
  repo: 'test-repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
});

const buildInMemoryLocalStorageRepository = (): LocalStorageRepository => {
  const files = new Map<string, string>();
  const directoryOf = (path: string): string =>
    path.split('/').slice(0, -1).join('/');
  return {
    write: (path, value) => {
      files.set(path, value);
    },
    read: (path) => {
      const value = files.get(path);
      if (value === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return value;
    },
    rename: (oldPath, newPath) => {
      const value = files.get(oldPath);
      if (value === undefined) {
        throw new Error(`ENOENT: ${oldPath}`);
      }
      files.delete(oldPath);
      files.set(newPath, value);
    },
    listFiles: (dirPath) =>
      [...files.keys()]
        .filter((path) => directoryOf(path) === dirPath)
        .map((path) => path.slice(dirPath.length + 1)),
    mkdir: () => undefined,
    remove: (path) => {
      files.delete(path);
    },
    tryCreateExclusive: (path) => {
      if (files.has(path)) {
        return false;
      }
      files.set(path, '');
      return true;
    },
    statMtimeMs: (path) => (files.has(path) ? Date.now() : null),
    readOrNull: (path) => files.get(path) ?? null,
  };
};

const buildCommentPayloads = (id: number) => [
  {
    id,
    user: { login: 'testuser' },
    body: 'Comment body',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-05T00:00:00Z',
  },
];

const buildExpectedComments = (id: number) => [
  {
    author: 'testuser',
    content: 'Comment body',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-05T00:00:00Z'),
    id: String(id),
  },
];

describe('GitHubIssueCommentRepository commentCacheRepository parameter type', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockCheckSecondaryRateLimitBreaker.mockReset();
    mockCheckSecondaryRateLimitBreaker.mockImplementation(
      (): { isBlocked: boolean; resetTimeMs: number | null } => ({
        isBlocked: false,
        resetTimeMs: null,
      }),
    );
    mockWriteSecondaryRateLimitState.mockReset();
  });

  it('caches the fetched page and answers the next 304 from the cache when given a plain generic passthrough withLock declared as the constructor accepted parameter type and re-typed as the literal Pick type', async () => {
    const store = new Map<string, unknown>();
    const acceptedCache: AcceptedCommentCacheRepository = {
      getSingle: async (key) => (store.has(key) ? store.get(key) : null),
      setSingle: async (key, value) => {
        store.set(key, value);
      },
      withLock: <T>(_key: string, fn: () => Promise<T>): Promise<T> => fn(),
    };
    const repository = new GitHubIssueCommentRepository(
      'test-token',
      acceptedCacheAsLiteralPick(acceptedCache),
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildCommentPayloads(5003)), {
          status: 200,
          headers: { ETag: '"etag-accepted-type"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const firstResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );
    const secondResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );

    expect(firstResult).toEqual(buildExpectedComments(5003));
    expect(secondResult).toEqual(buildExpectedComments(5003));
    expect(fetchSpy).toHaveBeenNthCalledWith(2, EXPECTED_REST_URL, {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'If-None-Match': '"etag-accepted-type"',
      },
    });
    expect(store.has('comments/HiromiShikata/test-repo/123')).toBe(true);
  });

  it('caches the fetched page and answers the next 304 from the cache when given a plain generic passthrough withLock declared as the literal Pick type', async () => {
    const store = new Map<string, unknown>();
    const passthroughCache: LiteralCommentCacheRepository = {
      getSingle: async (key) => (store.has(key) ? store.get(key) : null),
      setSingle: async (key, value) => {
        store.set(key, value);
      },
      withLock: <T>(_key: string, fn: () => Promise<T>): Promise<T> => fn(),
    };
    const repository = new GitHubIssueCommentRepository(
      'test-token',
      passthroughCache,
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildCommentPayloads(5001)), {
          status: 200,
          headers: { ETag: '"etag-literal-pick"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const firstResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );
    const secondResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );

    expect(firstResult).toEqual(buildExpectedComments(5001));
    expect(secondResult).toEqual(buildExpectedComments(5001));
    expect(fetchSpy).toHaveBeenNthCalledWith(1, EXPECTED_REST_URL, {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
      },
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(2, EXPECTED_REST_URL, {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'If-None-Match': '"etag-literal-pick"',
      },
    });
    expect(store.has('comments/HiromiShikata/test-repo/123')).toBe(true);
  });

  it('caches the fetched page and answers the next 304 from the cache when given a LocalStorageCacheRepository instance, as the production entry points construct it', async () => {
    const localStorageCacheRepository = new LocalStorageCacheRepository(
      buildInMemoryLocalStorageRepository(),
      './test-cache',
    );
    const repository = new GitHubIssueCommentRepository(
      'test-token',
      localStorageCacheRepository,
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(buildCommentPayloads(5002)), {
          status: 200,
          headers: { ETag: '"etag-local-storage"' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 304 }));

    const firstResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );
    const secondResult = await repository.getCommentsFromIssue(
      buildIssue(TEST_URL),
    );

    expect(firstResult).toEqual(buildExpectedComments(5002));
    expect(secondResult).toEqual(buildExpectedComments(5002));
    expect(fetchSpy).toHaveBeenNthCalledWith(2, EXPECTED_REST_URL, {
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/vnd.github+json',
        'If-None-Match': '"etag-local-storage"',
      },
    });
  });
});
