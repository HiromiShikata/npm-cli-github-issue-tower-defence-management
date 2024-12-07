import { Issue } from '../entities/Issue';
import { Member } from '../entities/Member';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import {
  GenerateWorkingTimeReportUseCase,
  WorkingReportTimelineEvent,
} from './GenerateWorkingTimeReportUseCase';
import { SpreadsheetRepository } from './adapter-interfaces/SpreadsheetRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { mock } from 'jest-mock-extended';

describe('GenerateWorkingTimeReportUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockSpreadsheetRepository = mock<SpreadsheetRepository>();
  const mockDateRepository = mock<DateRepository>();

  const useCase = new GenerateWorkingTimeReportUseCase(
    mockIssueRepository,
    mockSpreadsheetRepository,
    mockDateRepository,
  );
  describe('getWorkingReportIssueTemplate', () => {
    interface TestCase {
      name: string;
      input: {
        reportIssueTemplate?: string;
        manager: Member['name'];
        spreadsheetUrl: string;
      };
      expected: string;
    }

    const testCases: TestCase[] = [
      {
        name: 'should return custom template when provided',
        input: {
          reportIssueTemplate: 'Custom template for {AUTHOR}',
          manager: 'manager1',
          spreadsheetUrl: 'https://example.com',
        },
        expected: 'Custom template for {AUTHOR}',
      },
      {
        name: 'should return default template when no custom template provided',
        input: {
          manager: 'manager1',
          spreadsheetUrl: 'https://example.com',
        },
        expected: `
Please confirm each working time and total working time and assign to  :bow:
Fix warnings if you have :warning: mark in Detail section.
If you have any questions, please put comment and assign to @manager1 :pray:

## Working report for {AUTHOR} on {DATE_WITH_DAY_OF_WEEK}
### Total
\`\`\`
{TOTAL_WORKING_TIME_HHMM}
\`\`\`

### Detail
{TIMELINE_DETAILS}

Summary of working report: https://example.com
`,
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, async () => {
        const result = await useCase.getWorkingReportIssueTemplate(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('filterTimelineAndSortByAuthor', () => {
    interface TestCase {
      name: string;
      input: {
        issues: Issue[];
        targetDate: Date;
        author: Member['name'];
        workingTimeThresholdHour: number;
      };
      expected: WorkingReportTimelineEvent[];
    }

    const testCases: TestCase[] = [
      {
        name: 'should filter and sort timeline events correctly',
        input: {
          issues: [
            {
              nameWithOwner: 'org/repo',
              number: 1,
              title: 'Issue 1',
              state: 'OPEN',
              url: 'https://example.com/1',
              assignees: ['user1'],
              labels: [],
              workingTimeline: [
                {
                  author: 'user1',
                  startedAt: new Date('2024-01-01T09:00:00Z'),
                  endedAt: new Date('2024-01-01T12:00:00Z'),
                  durationMinutes: 180,
                },
              ],
              status: 'In Progress',
              story: 'test story',
              nextActionDate: new Date('2024-01-02'),
              nextActionHour: 10,
              estimationMinutes: 180,
              org: 'org',
              repo: 'repo',
              body: 'test body',
              itemId: 'itemId',
              isPr: false,
            },
          ],
          targetDate: new Date('2024-01-01'),
          author: 'user1',
          workingTimeThresholdHour: 6,
        },
        expected: [
          {
            issueUrl: 'https://example.com/1',
            startHhmm: '09:00',
            endHhmm: '12:00',
            durationHhmm: '03:00',
            warnings: [],
            labels: [],
            nameWithOwner: 'org/repo',
            issueTitle: 'Issue 1',
          },
        ],
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const result = useCase.filterTimelineAndSortByAuthor(
          input.issues,
          input.targetDate,
          input.author,
          input.workingTimeThresholdHour,
        );
        expect(result).toEqual(expected);
      });
    });
  });

  describe('convertIsoToHhmm', () => {
    interface TestCase {
      name: string;
      input: string;
      expected: string;
    }

    const testCases: TestCase[] = [
      {
        name: 'should convert ISO string to HH:mm format',
        input: '2024-01-01T09:30:00Z',
        expected: '09:30',
      },
      {
        name: 'should pad single digit hours and minutes',
        input: '2024-01-01T05:05:00Z',
        expected: '05:05',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const result = useCase.convertIsoToHhmm(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('calculateDuration', () => {
    interface TestCase {
      name: string;
      input: {
        startIsoString: string;
        endIsoString: string;
      };
      expected: string;
    }

    const testCases: TestCase[] = [
      {
        name: 'should calculate duration correctly',
        input: {
          startIsoString: '2024-01-01T09:00:00Z',
          endIsoString: '2024-01-01T12:30:00Z',
        },
        expected: '03:30',
      },
      {
        name: 'should handle same hour different minutes',
        input: {
          startIsoString: '2024-01-01T09:00:00Z',
          endIsoString: '2024-01-01T09:30:00Z',
        },
        expected: '00:30',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        const result = useCase.calculateDuration(
          input.startIsoString,
          input.endIsoString,
        );
        expect(result).toBe(expected);
      });
    });
  });

  describe('calculateTotalHhmm', () => {
    interface TestCase {
      name: string;
      input: WorkingReportTimelineEvent[];
      expected: string;
    }

    const testCases: TestCase[] = [
      {
        name: 'should calculate total duration correctly',
        input: [
          {
            issueUrl: 'https://example.com/1',
            startHhmm: '09:00',
            endHhmm: '12:00',
            durationHhmm: '03:00',
            warnings: [],
            labels: [],
            issueTitle: 'Issue 1',
            nameWithOwner: 'org/repo',
          },
          {
            issueUrl: 'https://example.com/2',
            startHhmm: '13:00',
            endHhmm: '15:30',
            durationHhmm: '02:30',
            warnings: [],
            labels: [],
            issueTitle: 'Issue 2',
            nameWithOwner: 'org/repo',
          },
        ],
        expected: '05:30',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        mockDateRepository.formatDurationToHHMM.mockImplementation(
          (durationMinutes: number) => {
            if (durationMinutes === 330) return '05:30';
            return '';
          },
        );
        const result = useCase.calculateTotalHhmm(input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('applyReplacementToTemplate', () => {
    interface TestCase {
      name: string;
      input: {
        template: string;
        replacement: Record<string, string>;
      };
      expected: string | Error;
    }

    const testCases: TestCase[] = [
      {
        name: 'should replace all placeholders correctly',
        input: {
          template: 'Hello {NAME}, your score is {SCORE}',
          replacement: {
            NAME: 'John',
            SCORE: '100',
          },
        },
        expected: 'Hello John, your score is 100',
      },
      {
        name: 'should throw error for unknown placeholders',
        input: {
          template: 'Hello {NAME}, your score is {UNKNOWN}',
          replacement: {
            NAME: 'John',
          },
        },
        expected: new Error('Failed to replace. Unknown keys: UNKNOWN'),
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        if (expected instanceof Error) {
          expect(() => useCase.applyReplacementToTemplate(input)).toThrowError(
            expected.message,
          );
        } else {
          const result = useCase.applyReplacementToTemplate(input);
          expect(result).toBe(expected);
        }
      });
    });
  });

  describe('run', () => {
    interface TestCase {
      name: string;
      input: Parameters<GenerateWorkingTimeReportUseCase['run']>[0];
      expectedCalls: number;
    }

    const testCases: TestCase[] = [
      {
        name: 'should create issues for all members',
        input: {
          issues: [
            {
              nameWithOwner: 'org/repo',
              number: 1,
              title: 'Issue 1',
              state: 'OPEN',
              url: 'https://example.com/1',
              assignees: ['user1'],
              labels: [],
              workingTimeline: [
                {
                  author: 'user1',
                  startedAt: new Date(),
                  endedAt: new Date(),
                  durationMinutes: 60,
                },
              ],
              status: 'In Progress',
              story: 'test story',
              nextActionDate: new Date(),
              nextActionHour: 10,
              estimationMinutes: 60,
              org: 'org',
              repo: 'repo',
              body: 'test body',
              itemId: 'itemId',
              isPr: false,
            },
          ],
          members: ['user1', 'user2'],
          manager: 'manager1',
          spreadsheetUrl: 'https://example.com',
          org: 'testOrg',
          repo: 'testRepo',
          reportIssueLabels: ['report'],
          warningThresholdHour: 6,
          targetDate: new Date(),
        },
        expectedCalls: 2,
      },
    ];

    testCases.forEach(({ name, input, expectedCalls }) => {
      it(name, async () => {
        await useCase.run(input);
        expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(
          expectedCalls,
        );
      });
    });
  });
});
