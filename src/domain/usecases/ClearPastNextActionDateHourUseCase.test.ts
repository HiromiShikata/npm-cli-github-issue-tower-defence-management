import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

describe('ClearPastNextActionDateHourUseCase', () => {
  jest.setTimeout(60 * 1000);
  const mockIssueRepository = mock<IssueRepository>();

  const nextActionHourField = {
    name: 'Next Action Hour',
    fieldId: 'hourFieldId',
    options: [],
  };
  const nextActionDateField = {
    name: 'Next Action Date',
    fieldId: 'dateFieldId',
  };

  const basicProject = {
    ...mock<Project>(),
    nextActionHour: nextActionHourField,
    nextActionDate: nextActionDateField,
  };

  const openIssueWithHour = {
    ...mock<Issue>(),
    state: 'OPEN' as const,
    nextActionHour: 10,
    nextActionDate: null,
  };

  const openIssueWithDateOnly = {
    ...mock<Issue>(),
    state: 'OPEN' as const,
    nextActionHour: null,
    nextActionDate: new Date('2026-04-01T00:00:00'),
  };

  describe('run', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    const testCases: {
      name: string;
      input: {
        targetDates: Date[];
        project: Project;
        issues: Issue[];
        cacheUsed: boolean;
      };
      expectedClearProjectFieldCalls: [Project, string, Issue][];
      liveIssuesReturnedByGetInCallOrder?: (Issue | null)[];
    }[] = [
      {
        name: 'should not clear anything when targetDates is empty',
        input: {
          targetDates: [],
          project: basicProject,
          issues: [openIssueWithDateOnly],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should not clear anything when project has no nextActionDate and no nextActionHour',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: null,
          },
          issues: [openIssueWithDateOnly],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should clear nextActionDate for issue with only nextActionDate set and date is before today',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: nextActionDateField,
          },
          issues: [
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [
          [
            {
              ...basicProject,
              nextActionHour: null,
              nextActionDate: nextActionDateField,
            },
            'dateFieldId',
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
        ],
        liveIssuesReturnedByGetInCallOrder: [
          {
            ...openIssueWithDateOnly,
            nextActionDate: new Date('2026-04-01T00:00:00'),
          },
        ],
      },
      {
        name: 'should clear nextActionDate when date is today',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: nextActionDateField,
          },
          issues: [
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-02T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [
          [
            {
              ...basicProject,
              nextActionHour: null,
              nextActionDate: nextActionDateField,
            },
            'dateFieldId',
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-02T00:00:00'),
            },
          ],
        ],
        liveIssuesReturnedByGetInCallOrder: [
          {
            ...openIssueWithDateOnly,
            nextActionDate: new Date('2026-04-02T00:00:00'),
          },
        ],
      },
      {
        name: 'should not clear nextActionDate when date is in the future',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: nextActionDateField,
          },
          issues: [
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-03T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should not clear nextActionDate when issue has nextActionHour set (handled by hour path)',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: nextActionDateField,
          },
          issues: [
            {
              ...mock<Issue>(),
              state: 'OPEN' as const,
              nextActionHour: 9,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should not clear nextActionDate when issue state is not OPEN',
        input: {
          targetDates: [new Date('2026-04-02T10:00:00')],
          project: {
            ...basicProject,
            nextActionHour: null,
            nextActionDate: nextActionDateField,
          },
          issues: [
            {
              ...openIssueWithDateOnly,
              state: 'CLOSED' as const,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should not clear nextActionHour at 09:45 when scheduled hour 10 has not yet arrived',
        input: {
          targetDates: [
            new Date('2026-04-02T09:45:00'),
            new Date('2026-04-02T09:46:00'),
          ],
          project: basicProject,
          issues: [
            {
              ...openIssueWithHour,
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should clear nextActionHour when sweep has no minute-45 tick but scheduled hour has already passed',
        input: {
          targetDates: [
            new Date('2026-04-02T10:05:00'),
            new Date('2026-04-02T10:15:00'),
          ],
          project: basicProject,
          issues: [
            {
              ...openIssueWithHour,
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [
          [
            basicProject,
            'hourFieldId',
            {
              ...openIssueWithHour,
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
        ],
        liveIssuesReturnedByGetInCallOrder: [
          {
            ...openIssueWithHour,
            nextActionHour: 10,
            nextActionDate: null,
          },
        ],
      },
      {
        name: 'should not clear nextActionDate when nextActionDate is null and hour trigger fires',
        input: {
          targetDates: [
            new Date('2026-09-20T04:00:00Z'),
            new Date('2026-09-20T04:01:00Z'),
          ],
          project: basicProject,
          issues: [
            {
              ...openIssueWithHour,
              nextActionHour: 1,
              nextActionDate: null,
            },
          ],
          cacheUsed: true,
        },
        expectedClearProjectFieldCalls: [
          [
            basicProject,
            'hourFieldId',
            {
              ...openIssueWithHour,
              nextActionHour: 1,
              nextActionDate: null,
            },
          ],
        ],
        liveIssuesReturnedByGetInCallOrder: [
          {
            ...openIssueWithHour,
            nextActionHour: 1,
            nextActionDate: null,
          },
        ],
      },
      {
        name: 'should not clear nextActionHour when scheduled hour has not yet arrived',
        input: {
          targetDates: [
            new Date('2026-04-02T09:00:00'),
            new Date('2026-04-02T09:01:00'),
          ],
          project: basicProject,
          issues: [
            {
              ...openIssueWithHour,
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [],
      },
      {
        name: 'should clear both nextActionDate-only issues and nextActionHour issues in same run',
        input: {
          targetDates: [
            new Date('2026-04-02T09:45:00'),
            new Date('2026-04-02T09:46:00'),
          ],
          project: basicProject,
          issues: [
            {
              ...openIssueWithHour,
              nextActionHour: 9,
              nextActionDate: null,
            },
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
          cacheUsed: false,
        },
        expectedClearProjectFieldCalls: [
          [
            basicProject,
            'hourFieldId',
            {
              ...openIssueWithHour,
              nextActionHour: 9,
              nextActionDate: null,
            },
          ],
          [
            basicProject,
            'dateFieldId',
            {
              ...openIssueWithDateOnly,
              nextActionDate: new Date('2026-04-01T00:00:00'),
            },
          ],
        ],
        liveIssuesReturnedByGetInCallOrder: [
          {
            ...openIssueWithHour,
            nextActionHour: 9,
            nextActionDate: null,
          },
          {
            ...openIssueWithDateOnly,
            nextActionDate: new Date('2026-04-01T00:00:00'),
          },
        ],
      },
    ];

    testCases.forEach(
      ({
        name,
        input,
        expectedClearProjectFieldCalls,
        liveIssuesReturnedByGetInCallOrder,
      }) => {
        it(name, async () => {
          jest.clearAllMocks();
          mockIssueRepository.get.mockReset();
          (liveIssuesReturnedByGetInCallOrder ?? []).forEach((liveIssue) => {
            mockIssueRepository.get.mockResolvedValueOnce(liveIssue);
          });
          const useCase = new ClearPastNextActionDateHourUseCase(
            mockIssueRepository,
          );
          await useCase.run(input);
          expect(mockIssueRepository.clearProjectField.mock.calls).toEqual(
            expectedClearProjectFieldCalls,
          );
        });
      },
    );

    describe('stale project item isolation and failure aggregation (issue #2789)', () => {
      const singleWriteTargetDates = [
        new Date('2026-04-02T10:05:00'),
        new Date('2026-04-02T10:15:00'),
      ];
      const buildSingleWriteIssue = (url: string, itemId: string): Issue => ({
        ...openIssueWithHour,
        url,
        itemId,
        nextActionHour: 10,
        nextActionDate: null,
      });
      const buildMultiWriteIssue = (url: string, itemId: string): Issue => ({
        ...openIssueWithHour,
        url,
        itemId,
        nextActionHour: 10,
        nextActionDate: new Date('2026-04-01T00:00:00'),
      });
      const mockGetToMirrorSnapshot = (issues: Issue[]) => {
        mockIssueRepository.get.mockReset();
        mockIssueRepository.get.mockImplementation(async (url) => {
          const found = issues.find((issue) => issue.url === url);
          return found ?? null;
        });
      };

      beforeEach(() => {
        jest.clearAllMocks();
      });

      it('skips an issue whose clearProjectField call fails with StaleProjectItemError, logging it via console.warn with the issue url and stale item id, while the other issue in the same run is still processed', async () => {
        const staleIssue = buildSingleWriteIssue(
          'https://github.com/o/r/issues/901',
          'item-stale-1',
        );
        const okIssue = buildSingleWriteIssue(
          'https://github.com/o/r/issues/902',
          'item-ok-1',
        );
        mockGetToMirrorSnapshot([staleIssue, okIssue]);
        const consoleWarnSpy = jest
          .spyOn(console, 'warn')
          .mockImplementation(() => undefined);
        mockIssueRepository.clearProjectField.mockImplementation(
          async (_project, _fieldId, issue) => {
            if (issue.url === staleIssue.url) {
              throw new StaleProjectItemError(staleIssue.itemId);
            }
          },
        );
        const useCase = new ClearPastNextActionDateHourUseCase(
          mockIssueRepository,
        );

        await useCase.run({
          targetDates: singleWriteTargetDates,
          project: basicProject,
          issues: [staleIssue, okIssue],
          cacheUsed: false,
        });

        expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
          [basicProject, 'hourFieldId', staleIssue],
          [basicProject, 'hourFieldId', okIssue],
        ]);
        const warnedMessages = consoleWarnSpy.mock.calls.map((call) =>
          call.join(' '),
        );
        expect(
          warnedMessages.some((message) => message.includes(staleIssue.url)),
        ).toBe(true);
        expect(
          warnedMessages.some((message) => message.includes(staleIssue.itemId)),
        ).toBe(true);
        consoleWarnSpy.mockRestore();
      });

      it('collects a non-stale error from one issue, still processes the other issue, and surfaces one rejection naming the failing issue and the underlying error', async () => {
        const failingIssue = buildSingleWriteIssue(
          'https://github.com/o/r/issues/903',
          'item-fail-1',
        );
        const okIssue = buildSingleWriteIssue(
          'https://github.com/o/r/issues/904',
          'item-ok-2',
        );
        mockGetToMirrorSnapshot([failingIssue, okIssue]);
        const underlyingError = new Error('GitHub API rate limit exceeded');
        mockIssueRepository.clearProjectField.mockImplementation(
          async (_project, _fieldId, issue) => {
            if (issue.url === failingIssue.url) {
              throw underlyingError;
            }
          },
        );
        const useCase = new ClearPastNextActionDateHourUseCase(
          mockIssueRepository,
        );

        const runPromise = useCase.run({
          targetDates: singleWriteTargetDates,
          project: basicProject,
          issues: [failingIssue, okIssue],
          cacheUsed: false,
        });

        runPromise.catch(() => {});
        let caughtError: unknown;
        try {
          await runPromise;
        } catch (error) {
          caughtError = error;
        }

        if (!(caughtError instanceof Error)) {
          throw new Error('Expected run() to reject with an Error instance');
        }
        expect(caughtError.message).toContain(failingIssue.url);
        expect(caughtError.message).toContain(underlyingError.message);
        expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
          [basicProject, 'hourFieldId', failingIssue],
          [basicProject, 'hourFieldId', okIssue],
        ]);
      });

      it('resolves normally when no exception occurs (no-op regression check)', async () => {
        const issueA = buildSingleWriteIssue(
          'https://github.com/o/r/issues/905',
          'item-a-1',
        );
        const issueB = buildSingleWriteIssue(
          'https://github.com/o/r/issues/906',
          'item-b-1',
        );
        mockGetToMirrorSnapshot([issueA, issueB]);
        mockIssueRepository.clearProjectField.mockResolvedValue(undefined);
        const useCase = new ClearPastNextActionDateHourUseCase(
          mockIssueRepository,
        );

        await expect(
          useCase.run({
            targetDates: singleWriteTargetDates,
            project: basicProject,
            issues: [issueA, issueB],
            cacheUsed: false,
          }),
        ).resolves.toBeUndefined();
        expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
          [basicProject, 'hourFieldId', issueA],
          [basicProject, 'hourFieldId', issueB],
        ]);
      });

      it('skips the second write (nextActionDate clear) for an issue whose first write (nextActionHour clear) fails with StaleProjectItemError, and still processes the next issue', async () => {
        const multiWriteStaleIssue = buildMultiWriteIssue(
          'https://github.com/o/r/issues/907',
          'item-stale-2',
        );
        const okIssue = buildSingleWriteIssue(
          'https://github.com/o/r/issues/908',
          'item-ok-3',
        );
        mockGetToMirrorSnapshot([multiWriteStaleIssue, okIssue]);
        mockIssueRepository.clearProjectField.mockImplementation(
          async (_project, fieldId, issue) => {
            if (
              issue.url === multiWriteStaleIssue.url &&
              fieldId === 'hourFieldId'
            ) {
              throw new StaleProjectItemError(multiWriteStaleIssue.itemId);
            }
          },
        );
        const useCase = new ClearPastNextActionDateHourUseCase(
          mockIssueRepository,
        );

        await useCase.run({
          targetDates: [new Date('2026-04-02T10:15:00')],
          project: basicProject,
          issues: [multiWriteStaleIssue, okIssue],
          cacheUsed: false,
        });

        expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
          [basicProject, 'hourFieldId', multiWriteStaleIssue],
          [basicProject, 'hourFieldId', okIssue],
        ]);
        expect(
          mockIssueRepository.clearProjectField.mock.calls.some(
            ([, fieldId, issue]) =>
              issue.url === multiWriteStaleIssue.url &&
              fieldId === 'dateFieldId',
          ),
        ).toBe(false);
      });
    });
  });
});
