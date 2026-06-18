import {
  consoleItemBodyFixture,
  consolePullRequestDetailFixture,
  consoleRelatedPullRequestsFixture,
} from '../fixtures';
import type { ConsoleApiClient } from './consoleApiClient';
import { createConsoleItemCache } from './consoleItemCache';

const createStubClient = (): {
  client: ConsoleApiClient;
  bodyCalls: jest.Mock;
} => {
  const bodyCalls = jest.fn(async () => consoleItemBodyFixture);
  const client: ConsoleApiClient = {
    fetchItemBody: bodyCalls,
    fetchComments: jest.fn(async () => consoleItemBodyFixture.comments),
    fetchPullRequestFiles: jest.fn(
      async () => consolePullRequestDetailFixture.files,
    ),
    fetchPullRequestCommits: jest.fn(
      async () => consolePullRequestDetailFixture.commits,
    ),
    fetchRelatedPullRequests: jest.fn(
      async () => consoleRelatedPullRequestsFixture,
    ),
    fetchPullRequestDetail: jest.fn(async () => ({
      ...consolePullRequestDetailFixture,
      files: [],
      commits: [],
    })),
    postReview: jest.fn(async () => undefined),
    postTriage: jest.fn(async () => undefined),
    postInTmux: jest.fn(async () => undefined),
  };
  return { client, bodyCalls };
};

describe('createConsoleItemCache', () => {
  it('fetches an item body once and serves later reads from cache', async () => {
    const { client, bodyCalls } = createStubClient();
    const cache = createConsoleItemCache(client);
    await cache.getItemBody('owner/repo', 1);
    await cache.getItemBody('owner/repo', 1);
    expect(bodyCalls).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight body request between concurrent callers', async () => {
    const { client, bodyCalls } = createStubClient();
    const cache = createConsoleItemCache(client);
    await Promise.all([
      cache.getItemBody('owner/repo', 2),
      cache.getItemBody('owner/repo', 2),
      cache.getComments('owner/repo', 2),
    ]);
    expect(bodyCalls).toHaveBeenCalledTimes(1);
  });

  it('combines detail, files, and commits into a single pull request detail', async () => {
    const { client } = createStubClient();
    const cache = createConsoleItemCache(client);
    const detail = await cache.getPullRequestDetail('owner/repo', 3);
    expect(detail?.files).toHaveLength(
      consolePullRequestDetailFixture.files.length,
    );
    expect(detail?.commits).toHaveLength(
      consolePullRequestDetailFixture.commits.length,
    );
  });
});
