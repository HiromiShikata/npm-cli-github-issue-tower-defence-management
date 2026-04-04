import { mock } from 'jest-mock-extended';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ClearPastNextActionDateHourUseCase } from './ClearPastNextActionDateHourUseCase';
import { Project } from '../entities/Project';
import { Issue } from '../entities/Issue';

describe('ClearPastNextActionDateHourUseCase', () => {
  jest.setTimeout(60 * 1000);
  const mockIssueRepository = mock<IssueRepository>();

  const nextActionHourField = {
    name: 'Next Action Hour',
    fieldId: 'hourFieldId',
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
        name: 'should clear nextActionHour and nextActionDate for issue with past nextActionHour at HH:45 target',
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
          [
            basicProject,
            'dateFieldId',
            {
              ...openIssueWithHour,
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
        ],
      },
      {
        name: 'should not clear nextActionHour when no HH:45 in targetDates',
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
              nextActionHour: 10,
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
              nextActionHour: 10,
              nextActionDate: null,
            },
          ],
          [
            basicProject,
            'dateFieldId',
            {
              ...openIssueWithHour,
              nextActionHour: 10,
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
      },
    ];

    testCases.forEach(({ name, input, expectedClearProjectFieldCalls }) => {
      it(name, async () => {
        jest.clearAllMocks();
        const useCase = new ClearPastNextActionDateHourUseCase(
          mockIssueRepository,
        );
        await useCase.run(input);
        expect(mockIssueRepository.clearProjectField.mock.calls).toEqual(
          expectedClearProjectFieldCalls,
        );
      });
    });
  });
});
