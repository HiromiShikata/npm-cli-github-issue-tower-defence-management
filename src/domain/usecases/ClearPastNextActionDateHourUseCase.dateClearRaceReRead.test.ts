import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('ClearPastNextActionDateHourUseCase - date clear race re-read', () => {
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

  const snapshotIssueUrl = 'https://github.com/org/repo/issues/501';

  const openIssueWithHourAndDate = {
    ...mock<Issue>(),
    url: snapshotIssueUrl,
    state: 'OPEN' as const,
    nextActionHour: 10,
    nextActionDate: new Date('2026-04-01T00:00:00'),
  };

  const openIssueWithHourAndNullDate = {
    ...openIssueWithHourAndDate,
    nextActionDate: null,
  };

  const targetDates = [
    new Date('2026-04-02T10:05:00'),
    new Date('2026-04-02T10:15:00'),
  ];

  describe('run', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    type LiveGetResponse = Issue | null | Error;

    const testCases: {
      name: string;
      issue: Issue;
      liveGetResponsesInCallOrder: LiveGetResponse[];
      expectedClearProjectFieldCalls: [Project, string, Issue][];
    }[] = [
      {
        name: 'clears the Date field when the live Next Action Date re-read still matches the snapshot',
        issue: openIssueWithHourAndDate,
        liveGetResponsesInCallOrder: [
          { ...openIssueWithHourAndDate },
          { ...openIssueWithHourAndDate },
        ],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndDate],
          [basicProject, 'dateFieldId', openIssueWithHourAndDate],
        ],
      },
      {
        name: 'does not clear the Date field when the live Next Action Date re-read differs from the snapshot (concurrent overwrite during the 5s wait)',
        issue: openIssueWithHourAndDate,
        liveGetResponsesInCallOrder: [
          { ...openIssueWithHourAndDate },
          {
            ...openIssueWithHourAndDate,
            nextActionDate: new Date('2026-04-05T00:00:00'),
          },
        ],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndDate],
        ],
      },
      {
        name: 'does not clear the Date field when the snapshot Next Action Date is null (existing short-circuit, no new guard needed)',
        issue: openIssueWithHourAndNullDate,
        liveGetResponsesInCallOrder: [{ ...openIssueWithHourAndNullDate }],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndNullDate],
        ],
      },
      {
        name: 'does not clear the Date field when the live re-read for the new guard throws',
        issue: openIssueWithHourAndDate,
        liveGetResponsesInCallOrder: [
          { ...openIssueWithHourAndDate },
          new Error(
            'simulated network error during Next Action Date re-read',
          ),
        ],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndDate],
        ],
      },
      {
        name: 'does not clear the Date field when the live re-read for the new guard resolves to null (issue deleted)',
        issue: openIssueWithHourAndDate,
        liveGetResponsesInCallOrder: [{ ...openIssueWithHourAndDate }, null],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndDate],
        ],
      },
      {
        name: 'still clears the Date field when the live Next Action Hour re-read for the new guard is already null, because the new guard depends only on Next Action Date',
        issue: openIssueWithHourAndDate,
        liveGetResponsesInCallOrder: [
          { ...openIssueWithHourAndDate },
          { ...openIssueWithHourAndDate, nextActionHour: null },
        ],
        expectedClearProjectFieldCalls: [
          [basicProject, 'hourFieldId', openIssueWithHourAndDate],
          [basicProject, 'dateFieldId', openIssueWithHourAndDate],
        ],
      },
    ];

    testCases.forEach(
      ({
        name,
        issue,
        liveGetResponsesInCallOrder,
        expectedClearProjectFieldCalls,
      }) => {
        it(name, async () => {
          jest.clearAllMocks();
          mockIssueRepository.get.mockReset();
          const callCountByUrl = new Map<string, number>();
          mockIssueRepository.get.mockImplementation(async (url) => {
            if (url !== issue.url) {
              return null;
            }
            const callIndex = callCountByUrl.get(url) ?? 0;
            callCountByUrl.set(url, callIndex + 1);
            const response = liveGetResponsesInCallOrder[callIndex] ?? null;
            if (response instanceof Error) {
              throw response;
            }
            return response;
          });
          const useCase = new ClearPastNextActionDateHourUseCase(
            mockIssueRepository,
          );

          await useCase.run({
            targetDates,
            project: basicProject,
            issues: [issue],
            cacheUsed: false,
          });

          expect(mockIssueRepository.clearProjectField.mock.calls).toEqual(
            expectedClearProjectFieldCalls,
          );
        });
      },
    );
  });
});
