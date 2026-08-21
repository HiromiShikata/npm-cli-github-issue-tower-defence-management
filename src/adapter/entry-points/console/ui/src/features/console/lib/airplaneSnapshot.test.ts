import {
  parseAirplaneSnapshot,
  readAirplaneModeFlag,
  writeAirplaneModeFlag,
} from './airplaneSnapshot';

describe('airplaneSnapshot', () => {
  describe('parseAirplaneSnapshot', () => {
    it('returns null for non-object input', () => {
      expect(parseAirplaneSnapshot(null)).toBeNull();
      expect(parseAirplaneSnapshot('string')).toBeNull();
      expect(parseAirplaneSnapshot(42)).toBeNull();
    });

    it('parses a minimal valid snapshot', () => {
      const raw = {
        capturedAt: '2026-01-01T00:00:00Z',
        tabs: {},
        items: {},
        failures: [],
      };
      const result = parseAirplaneSnapshot(raw);
      expect(result).not.toBeNull();
      expect(result?.capturedAt).toBe('2026-01-01T00:00:00Z');
      expect(result?.failures).toEqual([]);
    });

    it('parses tab snapshots with items', () => {
      const raw = {
        capturedAt: '2026-01-01T00:00:00Z',
        tabs: {
          acme: {
            prs: {
              generatedAt: '2026-01-01T00:00:00Z',
              statusOptions: [{ id: 'x', name: 'Open', color: 'GREEN' }],
              storyOptions: [],
              storyColors: {},
              items: [
                {
                  number: 1,
                  title: 'Fix bug',
                  url: 'https://github.com/o/r/pull/1',
                  repo: 'o/r',
                  nameWithOwner: 'o/r',
                  projectItemId: 'PVTI_1',
                  itemId: 'PVTI_1',
                  isPr: true,
                  story: 'regular',
                  status: 'In Progress',
                  nextActionDate: null,
                  nextActionHour: null,
                  dependedIssueUrls: [],
                  labels: ['bug'],
                  createdAt: '2026-01-01T00:00:00Z',
                  relatedOpenPullRequestUrls: [],
                },
              ],
            },
          },
        },
        items: {},
        failures: [],
      };

      const result = parseAirplaneSnapshot(raw);
      expect(result?.tabs.acme?.prs.items).toHaveLength(1);
      expect(result?.tabs.acme?.prs.items[0].title).toBe('Fix bug');
      expect(result?.tabs.acme?.prs.statusOptions).toHaveLength(1);
    });

    it('parses item snapshots with PR fields', () => {
      const url = 'https://github.com/o/r/pull/1';
      const raw = {
        capturedAt: '2026-01-01T00:00:00Z',
        tabs: {},
        failures: [],
        items: {
          [url]: {
            body: 'PR body text',
            comments: [
              {
                author: 'alice',
                body: 'LGTM',
                createdAt: '2026-01-01T01:00:00Z',
              },
            ],
            state: {
              state: 'open',
              merged: false,
              isPullRequest: true,
              title: 'PR',
            },
            files: [
              {
                path: 'src/foo.ts',
                additions: 5,
                deletions: 2,
                status: 'modified',
                patch: '@@ diff @@',
                rawUrl: null,
              },
            ],
            commits: [
              {
                sha: 'abc',
                message: 'fix',
                author: 'alice',
                authoredAt: '2026-01-01T00:00:00Z',
              },
            ],
            prStatus: {
              found: true,
              isConflicted: false,
              mergeableStatus: 'MERGEABLE',
              isPassedAllCiJob: true,
              isCiStateSuccess: true,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
            },
            relatedPrs: null,
          },
        },
      };

      const result = parseAirplaneSnapshot(raw);
      const item = result?.items[url];
      expect(item?.body).toBe('PR body text');
      expect(item?.comments).toHaveLength(1);
      expect(item?.comments[0].author).toBe('alice');
      expect(item?.state.isPullRequest).toBe(true);
      expect(item?.files).toHaveLength(1);
      expect(item?.files?.[0].path).toBe('src/foo.ts');
      expect(item?.commits).toHaveLength(1);
      expect(item?.prStatus?.isPassedAllCiJob).toBe(true);
      expect(item?.prStatus?.mergeableStatus).toBe('MERGEABLE');
      expect(item?.relatedPrs).toBeNull();
    });

    it('parses item snapshots with issue fields', () => {
      const url = 'https://github.com/o/r/issues/5';
      const raw = {
        capturedAt: '2026-01-01T00:00:00Z',
        tabs: {},
        failures: [],
        items: {
          [url]: {
            body: 'Issue body',
            comments: [],
            state: {
              state: 'open',
              merged: false,
              isPullRequest: false,
              title: 'Issue',
            },
            files: null,
            commits: null,
            prStatus: null,
            relatedPrs: [
              {
                url: 'https://github.com/o/r/pull/10',
                branchName: 'fix-branch',
                createdAt: '2026-01-01T00:00:00Z',
                isDraft: false,
                isConflicted: false,
                mergeableStatus: 'MERGEABLE',
                isPassedAllCiJob: true,
                isCiStateSuccess: true,
                isResolvedAllReviewComments: true,
                isBranchOutOfDate: false,
                missingRequiredCheckNames: [],
                summary: null,
              },
            ],
          },
        },
      };

      const result = parseAirplaneSnapshot(raw);
      const item = result?.items[url];
      expect(item?.files).toBeNull();
      expect(item?.commits).toBeNull();
      expect(item?.prStatus).toBeNull();
      expect(item?.relatedPrs).toHaveLength(1);
      expect(item?.relatedPrs?.[0].url).toBe('https://github.com/o/r/pull/10');
    });

    it('handles unknown mergeableStatus gracefully', () => {
      const url = 'https://github.com/o/r/pull/2';
      const raw = {
        capturedAt: '',
        tabs: {},
        failures: [],
        items: {
          [url]: {
            body: '',
            comments: [],
            state: {
              state: 'open',
              merged: false,
              isPullRequest: true,
              title: '',
            },
            files: [],
            commits: [],
            prStatus: {
              found: true,
              isConflicted: false,
              mergeableStatus: 'UNKNOWN',
              isPassedAllCiJob: false,
              isCiStateSuccess: false,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
            },
            relatedPrs: null,
          },
        },
      };
      const result = parseAirplaneSnapshot(raw);
      expect(result?.items[url]?.prStatus?.mergeableStatus).toBe('UNKNOWN');
    });

    it('records failures from the raw payload', () => {
      const raw = {
        capturedAt: '',
        tabs: {},
        items: {},
        failures: ['https://github.com/o/r/issues/99'],
      };
      const result = parseAirplaneSnapshot(raw);
      expect(result?.failures).toContain('https://github.com/o/r/issues/99');
    });

    it('parses stories and defaultNameWithOwner from a tab snapshot', () => {
      const raw = {
        capturedAt: '2026-01-01T00:00:00Z',
        tabs: {
          acme: {
            stories: {
              generatedAt: '2026-01-01T00:00:00Z',
              statusOptions: [],
              storyOptions: [],
              storyColors: {},
              items: [],
              stories: [
                {
                  storyName: 'regular',
                  storyOptionId: 'opt-1',
                  color: 'GREEN',
                  openItemCount: 3,
                },
              ],
              defaultNameWithOwner: 'owner/repo',
            },
          },
        },
        items: {},
        failures: [],
      };
      const result = parseAirplaneSnapshot(raw);
      const storiesTab = result?.tabs.acme?.stories;
      expect(storiesTab?.stories).toHaveLength(1);
      expect(storiesTab?.stories[0].storyName).toBe('regular');
      expect(storiesTab?.defaultNameWithOwner).toBe('owner/repo');
    });
  });

  describe('readAirplaneModeFlag / writeAirplaneModeFlag', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('returns false when the flag has never been written', () => {
      expect(readAirplaneModeFlag()).toBe(false);
    });

    it('returns true after writeAirplaneModeFlag(true)', () => {
      writeAirplaneModeFlag(true);
      expect(readAirplaneModeFlag()).toBe(true);
    });

    it('returns false after writeAirplaneModeFlag(false)', () => {
      writeAirplaneModeFlag(true);
      writeAirplaneModeFlag(false);
      expect(readAirplaneModeFlag()).toBe(false);
    });
  });
});
