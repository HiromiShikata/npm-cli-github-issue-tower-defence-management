import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalStorageStoryGateBoardCacheRepository } from './LocalStorageStoryGateBoardCacheRepository';

type CachedIssueFixture = {
  number: number;
  story: string | null;
  labels?: string[];
  body?: string;
};

const issueUrl = (number: number): string =>
  `https://github.com/example-org/repo/issues/${number}`;

const boardCacheWrite = (
  baseDirectory: string,
  projectName: string,
  directoryName: string,
  projectId: string,
  issues: CachedIssueFixture[],
  modifiedAt: Date,
): string => {
  const directory = path.join(baseDirectory, projectName, directoryName);
  fs.mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, 'latest.json');
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      lastFetchedAt: '2026-09-01T00:00:00Z',
      lastFullFetchAt: '2026-09-01T00:00:00Z',
      project: {
        id: projectId,
        url: 'https://github.com/orgs/example-org/projects/1',
        databaseId: 1,
        name: 'Example board',
        status: { name: 'Status', fieldId: 'FIELD_status', statuses: [] },
        story: {
          name: 'Story',
          fieldId: 'FIELD_story',
          databaseId: 2,
          stories: [
            {
              id: 'OPT_feature_a',
              name: 'feature A',
              color: 'GREEN',
              description: '',
            },
            {
              id: 'OPT_retired',
              name: 'retired story',
              color: 'GRAY',
              description: '',
            },
          ],
          workflowManagementStory: {
            id: 'OPT_workflow',
            name: 'regular / workflow management',
          },
        },
      },
      issues: issues.map((issue) => ({
        nameWithOwner: 'example-org/repo',
        number: issue.number,
        title: `Issue ${issue.number}`,
        url: issueUrl(issue.number),
        story: issue.story,
        labels: issue.labels ?? [],
        body: issue.body ?? '',
        itemId: `ITEM_${issue.number}`,
      })),
      storyIssueUrlByOptionName: { 'feature A': issueUrl(100) },
      storyOptions: [],
    }),
  );
  fs.utimesSync(filePath, modifiedAt, modifiedAt);
  return filePath;
};

describe('LocalStorageStoryGateBoardCacheRepository', () => {
  let baseDirectory: string;

  beforeEach(() => {
    baseDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-board-cache-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(baseDirectory, { recursive: true, force: true });
  });

  it('maps a board cache file', async () => {
    const modifiedAt = new Date('2026-09-10T00:00:00Z');
    const filePath = boardCacheWrite(
      baseDirectory,
      'example',
      'allIssues-PVT_board',
      'PVT_board',
      [
        {
          number: 1,
          story: 'feature A',
          labels: ['story'],
          body: 'Body of issue 1',
        },
        { number: 2, story: null },
      ],
      modifiedAt,
    );

    const caches = await new LocalStorageStoryGateBoardCacheRepository(
      baseDirectory,
    ).listBoardCachesNewestFirst();

    expect(caches).toEqual([
      {
        filePath,
        modifiedAt,
        projectId: 'PVT_board',
        storyFieldId: 'FIELD_story',
        storyOptions: [
          { id: 'OPT_feature_a', name: 'feature A', color: 'GREEN' },
          { id: 'OPT_retired', name: 'retired story', color: 'GRAY' },
        ],
        storyIssueUrlByOptionName: { 'feature A': issueUrl(100) },
        issues: [
          {
            url: issueUrl(1),
            story: 'feature A',
            labels: ['story'],
            body: 'Body of issue 1',
            itemId: 'ITEM_1',
          },
          {
            url: issueUrl(2),
            story: null,
            labels: [],
            body: '',
            itemId: 'ITEM_2',
          },
        ],
      },
    ]);
  });

  it.each([
    { name: 'the first project directory', newest: 'alpha', stale: 'beta' },
    { name: 'the last project directory', newest: 'beta', stale: 'alpha' },
  ])(
    'lists the newest modified cache first when it is in $name',
    async ({ newest, stale }) => {
      const newestPath = boardCacheWrite(
        baseDirectory,
        newest,
        'allIssues-PVT_board',
        'PVT_board',
        [{ number: 1, story: 'feature B' }],
        new Date('2026-09-20T00:00:00Z'),
      );
      const stalePath = boardCacheWrite(
        baseDirectory,
        stale,
        'allIssues-PVT_board',
        'PVT_board',
        [{ number: 1, story: 'feature A' }],
        new Date('2026-09-01T00:00:00Z'),
      );

      const caches = await new LocalStorageStoryGateBoardCacheRepository(
        baseDirectory,
      ).listBoardCachesNewestFirst();

      expect(caches.map((cache) => cache.filePath)).toEqual([
        newestPath,
        stalePath,
      ]);
      expect(caches.map((cache) => cache.issues[0].story)).toEqual([
        'feature B',
        'feature A',
      ]);
    },
  );

  it('ignores directories that are not board caches and unreadable files', async () => {
    const boardPath = boardCacheWrite(
      baseDirectory,
      'example',
      'allIssues-PVT_board',
      'PVT_board',
      [{ number: 1, story: 'feature A' }],
      new Date('2026-09-10T00:00:00Z'),
    );
    boardCacheWrite(
      baseDirectory,
      'example',
      'projectFields-PVT_board',
      'PVT_board',
      [{ number: 1, story: 'feature B' }],
      new Date('2026-09-20T00:00:00Z'),
    );
    fs.mkdirSync(path.join(baseDirectory, 'example', 'allIssues-PVT_empty'), {
      recursive: true,
    });
    const brokenDirectory = path.join(
      baseDirectory,
      'example',
      'allIssues-PVT_broken',
    );
    fs.mkdirSync(brokenDirectory, { recursive: true });
    fs.writeFileSync(path.join(brokenDirectory, 'latest.json'), '{not json');
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    const caches = await new LocalStorageStoryGateBoardCacheRepository(
      baseDirectory,
    ).listBoardCachesNewestFirst();

    expect(caches.map((cache) => cache.filePath)).toEqual([boardPath]);
  });

  it('returns no cache when the base directory does not exist', async () => {
    const caches = await new LocalStorageStoryGateBoardCacheRepository(
      path.join(baseDirectory, 'missing'),
    ).listBoardCachesNewestFirst();

    expect(caches).toEqual([]);
  });
});
