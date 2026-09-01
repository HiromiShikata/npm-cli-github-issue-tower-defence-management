import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
import type { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IssueTitleStateCache, PullRequestStatusCache } from './consoleReadApi';
import {
  handleAirplaneSync,
  type AirplaneSyncEvent,
  type AirplaneSyncResponseWriter,
} from './consoleAirplaneSnapshotApi';

type DoneEvent = Extract<AirplaneSyncEvent, { type: 'done' }>;
type ProgressEvent = Extract<AirplaneSyncEvent, { type: 'progress' }>;

const isDoneEvent = (e: unknown): e is DoneEvent =>
  e !== null && typeof e === 'object' && 'type' in e && e.type === 'done';

const isProgressEvent = (e: unknown): e is ProgressEvent =>
  e !== null && typeof e === 'object' && 'type' in e && e.type === 'progress';

const collectSseEvents = (chunks: string[]): unknown[] => {
  const raw = chunks.join('');
  return raw
    .split('\n\n')
    .filter((block) => block.startsWith('data: '))
    .map((block) => {
      const event: unknown = JSON.parse(block.slice('data: '.length));
      return event;
    });
};

const makeResponse = (): {
  response: AirplaneSyncResponseWriter;
  chunks: string[];
  ended: () => boolean;
} => {
  const chunks: string[] = [];
  let isEnded = false;
  const response: AirplaneSyncResponseWriter = {
    writeHead: jest.fn(),
    write: (chunk: string) => {
      chunks.push(chunk);
    },
    end: () => {
      isEnded = true;
    },
  };
  return { response, chunks, ended: () => isEnded };
};

const writeListJson = (
  dir: string,
  pjcode: string,
  tab: string,
  data: unknown,
): void => {
  const tabDir = path.join(dir, pjcode, tab);
  fs.mkdirSync(tabDir, { recursive: true });
  fs.writeFileSync(path.join(tabDir, 'list.json'), JSON.stringify(data));
};

describe('handleAirplaneSync', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'airplane-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('sends progress=0 immediately and done event with no items when data dir is empty', async () => {
    const issueRepository = mock<IssueRepository>();
    const { response, chunks, ended } = makeResponse();

    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    expect(events[0]).toEqual({ type: 'progress', fetched: 0, total: 0 });
    const doneEvent = events.find(isDoneEvent);
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.snapshot.failures).toEqual([]);
    expect(doneEvent?.snapshot.items).toEqual({});
    expect(ended()).toBe(true);
  });

  it('fetches body, comments, state and files/commits/prStatus for a PR item', async () => {
    const issueRepository = mock<IssueRepository>();
    const prUrl = 'https://github.com/owner/repo/pull/1';

    writeListJson(tmpDir, 'acme', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [
        {
          url: prUrl,
          isPr: true,
          number: 1,
          projectItemId: 'PVTI_1',
        },
      ],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('PR body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([
      {
        author: 'alice',
        body: 'nice pr',
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Fix the bug',
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Fix the bug',
      state: 'OPEN',
      merged: false,
      isDraft: false,
      additions: 3,
      deletions: 1,
      changedFiles: 1,
      headRefName: 'feature/fix',
      baseRefName: 'main',
      author: 'alice',
      files: [
        {
          filename: 'src/foo.ts',
          status: 'modified',
          additions: 3,
          deletions: 1,
          patch: '@@ -1 +1 @@\n-old\n+new',
          rawUrl: null,
        },
      ],
    });
    issueRepository.getPullRequestCommits.mockResolvedValue([
      {
        sha: 'abc123',
        message: 'chore: update',
        author: 'alice',
        authoredAt: new Date('2026-01-01T10:00:00Z'),
      },
    ]);
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue({
      url: 'https://github.com/owner/repo/pull/1',
      isConflicted: false,
      mergeable: 'MERGEABLE',
      isPassedAllCiJob: true,
      isCiStateSuccess: true,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    });

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const progressEvents = events.filter(isProgressEvent);
    expect(progressEvents[0]).toEqual({
      type: 'progress',
      fetched: 0,
      total: 1,
    });
    expect(progressEvents[progressEvents.length - 1]).toEqual({
      type: 'progress',
      fetched: 1,
      total: 1,
    });

    const doneEvent = events.find(isDoneEvent);
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.snapshot.failures).toEqual([]);

    const itemData = doneEvent?.snapshot.items[prUrl];
    expect(itemData).toBeDefined();
    expect(itemData?.body).toBe('PR body');
    expect(itemData?.comments).toEqual([
      {
        author: 'alice',
        body: 'nice pr',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    expect(itemData?.state).toEqual({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Fix the bug',
    });
    expect(itemData?.files).toEqual([
      {
        path: 'src/foo.ts',
        additions: 3,
        deletions: 1,
        status: 'modified',
        patch: '@@ -1 +1 @@\n-old\n+new',
        rawUrl: null,
      },
    ]);
    expect(itemData?.commits).toEqual([
      {
        sha: 'abc123',
        message: 'chore: update',
        author: 'alice',
        authoredAt: '2026-01-01T10:00:00.000Z',
      },
    ]);
    expect(itemData?.prStatus?.isPassedAllCiJob).toBe(true);
    expect(itemData?.prStatus?.mergeableStatus).toBe('MERGEABLE');
    expect(itemData?.relatedPrs).toBeNull();
  });

  it('fetches relatedPrs for a non-PR issue', async () => {
    const issueRepository = mock<IssueRepository>();
    const issueUrl = 'https://github.com/owner/repo/issues/5';

    writeListJson(tmpDir, 'acme', 'todo-by-human', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [
        {
          url: issueUrl,
          isPr: false,
          number: 5,
          projectItemId: 'PVTI_5',
        },
      ],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('Issue body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'Fix something',
    });
    issueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    const itemData = doneEvent?.snapshot.items[issueUrl];
    expect(itemData?.files).toBeNull();
    expect(itemData?.commits).toBeNull();
    expect(itemData?.prStatus).toBeNull();
    expect(itemData?.relatedPrs).toEqual([]);
  });

  it('deduplicates items that appear in multiple tabs', async () => {
    const issueRepository = mock<IssueRepository>();
    const sharedUrl = 'https://github.com/owner/repo/pull/7';

    const itemEntry = {
      url: sharedUrl,
      isPr: true,
      number: 7,
      projectItemId: 'PVTI_7',
    };
    writeListJson(tmpDir, 'acme', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [itemEntry],
    });
    writeListJson(tmpDir, 'acme', 'workflow-blocker', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [itemEntry],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'PR title',
    });
    issueRepository.getPullRequestDetail.mockResolvedValue(null);
    issueRepository.getPullRequestCommits.mockResolvedValue([]);
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(null);

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const progressEvents = events.filter(isProgressEvent);
    expect(progressEvents[0]?.total).toBe(1);

    expect(issueRepository.getIssueOrPullRequestBody).toHaveBeenCalledTimes(1);
  });

  it('records failures and still sends done event when an item fetch fails', async () => {
    const issueRepository = mock<IssueRepository>();
    const failingUrl = 'https://github.com/owner/repo/issues/99';

    writeListJson(tmpDir, 'acme', 'todo-by-human', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [
        {
          url: failingUrl,
          isPr: false,
          number: 99,
          projectItemId: 'PVTI_99',
        },
      ],
    });

    issueRepository.getIssueOrPullRequestBody.mockRejectedValue(
      new Error('network failure'),
    );

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.snapshot.failures).toContain(failingUrl);
    expect(doneEvent?.snapshot.items[failingUrl]).toBeUndefined();
  });

  it('does not report airplane mode on while a fetch is outstanding', async () => {
    const issueRepository = mock<IssueRepository>();
    const url1 = 'https://github.com/owner/repo/issues/1';
    const url2 = 'https://github.com/owner/repo/issues/2';

    writeListJson(tmpDir, 'acme', 'todo-by-human', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [
        { url: url1, isPr: false, number: 1, projectItemId: 'PVTI_1' },
        { url: url2, isPr: false, number: 2, projectItemId: 'PVTI_2' },
      ],
    });

    let resolveFirst: () => void = () => {};
    const firstFetchStarted = new Promise<void>((res) => {
      resolveFirst = res;
    });

    issueRepository.getIssueOrPullRequestBody.mockImplementation(async (u) => {
      if (u === url1) {
        resolveFirst();
        await new Promise((r) => setTimeout(r, 50));
        return 'body1';
      }
      return 'body2';
    });
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'x',
    });
    issueRepository.findRelatedOpenPRs.mockResolvedValue([]);

    const { response, chunks } = makeResponse();

    const syncDone = handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    await firstFetchStarted;

    const eventsBeforeDone = collectSseEvents(chunks);
    const hasDoneBeforeAllFetched = eventsBeforeDone.some(isDoneEvent);
    expect(hasDoneBeforeAllFetched).toBe(false);

    await syncDone;

    const eventsAfterDone = collectSseEvents(chunks);
    const doneEvent = eventsAfterDone.find(isDoneEvent);
    expect(doneEvent).toBeDefined();
  });

  it('fetches raw text content for a PR file whose patch is null and stores it as patch', async () => {
    const issueRepository = mock<IssueRepository>();
    const prUrl = 'https://github.com/owner/repo/pull/10';
    const rawFileUrl =
      'https://raw.githubusercontent.com/owner/repo/sha/src/large.ts';

    writeListJson(tmpDir, 'acme', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [{ url: prUrl, isPr: true, number: 10, projectItemId: 'PVTI_10' }],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Large file PR',
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Large file PR',
      state: 'OPEN',
      merged: false,
      isDraft: false,
      additions: 10,
      deletions: 0,
      changedFiles: 1,
      headRefName: 'feat',
      baseRefName: 'main',
      author: 'alice',
      files: [
        {
          filename: 'src/large.ts',
          status: 'modified',
          additions: 10,
          deletions: 0,
          patch: null,
          rawUrl: rawFileUrl,
        },
      ],
    });
    issueRepository.getPullRequestCommits.mockResolvedValue([]);
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(null);

    const rawText = 'export const x = 1;\n';
    const rawBuf = Buffer.from(rawText);
    const rawArrayBuffer = rawBuf.buffer.slice(
      rawBuf.byteOffset,
      rawBuf.byteOffset + rawBuf.byteLength,
    );
    const globalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/plain; charset=utf-8' },
      arrayBuffer: async () => rawArrayBuffer,
    });

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
      'gh-token',
    );

    global.fetch = globalFetch;

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    const file = doneEvent?.snapshot.items[prUrl]?.files?.[0];
    expect(file?.patch).toBe(rawText);
    expect(file?.rawUrl).toBe(rawFileUrl);
  });

  it('fetches raw image content for a PR file whose patch is null and stores it as a data URL', async () => {
    const issueRepository = mock<IssueRepository>();
    const prUrl = 'https://github.com/owner/repo/pull/11';
    const rawFileUrl =
      'https://raw.githubusercontent.com/owner/repo/sha/assets/logo.png';

    writeListJson(tmpDir, 'acme', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [{ url: prUrl, isPr: true, number: 11, projectItemId: 'PVTI_11' }],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'Logo update',
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'Logo update',
      state: 'OPEN',
      merged: false,
      isDraft: false,
      additions: 0,
      deletions: 0,
      changedFiles: 1,
      headRefName: 'feat',
      baseRefName: 'main',
      author: 'alice',
      files: [
        {
          filename: 'assets/logo.png',
          status: 'modified',
          additions: 0,
          deletions: 0,
          patch: null,
          rawUrl: rawFileUrl,
        },
      ],
    });
    issueRepository.getPullRequestCommits.mockResolvedValue([]);
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(null);

    const fakeImageBytes = Buffer.from([137, 80, 78, 71]);
    const globalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => fakeImageBytes.buffer,
    });

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
      'gh-token',
    );

    global.fetch = globalFetch;

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    const file = doneEvent?.snapshot.items[prUrl]?.files?.[0];
    expect(file?.patch).toBeNull();
    expect(file?.rawUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('leaves files unchanged when ghToken is null even if rawUrl is present', async () => {
    const issueRepository = mock<IssueRepository>();
    const prUrl = 'https://github.com/owner/repo/pull/12';
    const rawFileUrl =
      'https://raw.githubusercontent.com/owner/repo/sha/src/big.ts';

    writeListJson(tmpDir, 'acme', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [{ url: prUrl, isPr: true, number: 12, projectItemId: 'PVTI_12' }],
    });

    issueRepository.getIssueOrPullRequestBody.mockResolvedValue('body');
    issueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    issueRepository.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: true,
      title: 'No token',
    });
    issueRepository.getPullRequestDetail.mockResolvedValue({
      title: 'No token',
      state: 'OPEN',
      merged: false,
      isDraft: false,
      additions: 0,
      deletions: 0,
      changedFiles: 1,
      headRefName: 'feat',
      baseRefName: 'main',
      author: 'alice',
      files: [
        {
          filename: 'src/big.ts',
          status: 'modified',
          additions: 0,
          deletions: 0,
          patch: null,
          rawUrl: rawFileUrl,
        },
      ],
    });
    issueRepository.getPullRequestCommits.mockResolvedValue([]);
    issueRepository.getOpenPullRequestCiStatus.mockResolvedValue(null);

    const fetchSpy = jest.fn();
    const globalFetch = global.fetch;
    global.fetch = fetchSpy;

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
      null,
    );

    global.fetch = globalFetch;

    expect(fetchSpy).not.toHaveBeenCalled();
    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    const file = doneEvent?.snapshot.items[prUrl]?.files?.[0];
    expect(file?.patch).toBeNull();
    expect(file?.rawUrl).toBe(rawFileUrl);
  });

  it('includes tab data for all discovered pjcodes in the snapshot', async () => {
    const issueRepository = mock<IssueRepository>();

    writeListJson(tmpDir, 'proj1', 'prs', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [],
    });
    writeListJson(tmpDir, 'proj2', 'todo-by-human', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [],
    });

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      () => issueRepository,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    expect(doneEvent?.snapshot.tabs['proj1']).toBeDefined();
    expect(doneEvent?.snapshot.tabs['proj2']).toBeDefined();
    expect(doneEvent?.snapshot.tabs['proj1']?.['prs']).toBeDefined();
    expect(doneEvent?.snapshot.tabs['proj2']?.['todo-by-human']).toBeDefined();
  });

  it('routes each item to the repository resolved for its URL', async () => {
    const defaultRepo = mock<IssueRepository>();
    const metaSiteRepo = mock<IssueRepository>();

    const defaultUrl = 'https://github.com/HiromiShikata/repo/issues/1';
    const metaSiteUrl = 'https://github.com/meta-site/repo/issues/2';

    writeListJson(tmpDir, 'umino', 'todo-by-agent', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [{ url: defaultUrl, isPr: false, number: 1, projectItemId: 'PVTI_1' }],
    });
    writeListJson(tmpDir, 'cmg', 'todo-by-human', {
      generatedAt: '2026-01-01T00:00:00Z',
      items: [{ url: metaSiteUrl, isPr: false, number: 2, projectItemId: 'PVTI_2' }],
    });

    defaultRepo.getIssueOrPullRequestBody.mockResolvedValue('default body');
    defaultRepo.getIssueOrPullRequestComments.mockResolvedValue([]);
    defaultRepo.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'default issue',
    });
    defaultRepo.findRelatedOpenPRs.mockResolvedValue([]);

    metaSiteRepo.getIssueOrPullRequestBody.mockResolvedValue('meta-site body');
    metaSiteRepo.getIssueOrPullRequestComments.mockResolvedValue([]);
    metaSiteRepo.getIssueOrPullRequestState.mockResolvedValue({
      state: 'open',
      merged: false,
      isPullRequest: false,
      title: 'meta-site issue',
    });
    metaSiteRepo.findRelatedOpenPRs.mockResolvedValue([]);

    const { response, chunks } = makeResponse();
    await handleAirplaneSync(
      response,
      tmpDir,
      (url: string) =>
        url.includes('meta-site') ? metaSiteRepo : defaultRepo,
      new IssueTitleStateCache(),
      new PullRequestStatusCache(),
    );

    const events = collectSseEvents(chunks);
    const doneEvent = events.find(isDoneEvent);
    expect(doneEvent?.snapshot.failures).toEqual([]);
    expect(metaSiteRepo.getIssueOrPullRequestBody).toHaveBeenCalledWith(
      metaSiteUrl,
    );
    expect(defaultRepo.getIssueOrPullRequestBody).not.toHaveBeenCalledWith(
      metaSiteUrl,
    );
    expect(defaultRepo.getIssueOrPullRequestBody).toHaveBeenCalledWith(
      defaultUrl,
    );
    expect(metaSiteRepo.getIssueOrPullRequestBody).not.toHaveBeenCalledWith(
      defaultUrl,
    );
  });
});
