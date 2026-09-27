import { mock } from 'jest-mock-extended';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

describe('UpdateIssueStatusByLabelUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  const mockTodoStatus = mock<FieldOption>();
  mockTodoStatus.id = 'status1';
  mockTodoStatus.name = 'ToDo';

  const mockInProgressStatus = mock<FieldOption>();
  mockInProgressStatus.id = 'status2';
  mockInProgressStatus.name = 'In Progress';

  const mockIceboxStatus = mock<FieldOption>();
  mockIceboxStatus.id = 'status3';
  mockIceboxStatus.name = 'Icebox';

  const basicProject = {
    ...mock<Project>(),
    status: {
      name: 'Status Field',
      fieldId: 'statusFieldId',
      statuses: [mockTodoStatus, mockInProgressStatus, mockIceboxStatus],
    },
  };

  let useCase: UpdateIssueStatusByLabelUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new UpdateIssueStatusByLabelUseCase(mockIssueRepository);
  });

  describe('normalizeStatus', () => {
    const testCases: {
      name: string;
      input: string;
      expected: string;
    }[] = [
      {
        name: 'should remove spaces',
        input: 'In Progress',
        expected: 'inprogress',
      },
      {
        name: 'should remove hyphens',
        input: 'in-progress',
        expected: 'inprogress',
      },
      {
        name: 'should remove underscores',
        input: 'in_progress',
        expected: 'inprogress',
      },
      {
        name: 'should convert to lowercase',
        input: 'IN PROGRESS',
        expected: 'inprogress',
      },
      {
        name: 'should handle mixed separators',
        input: 'In-Progress_Now',
        expected: 'inprogressnow',
      },
      {
        name: 'should handle no separators',
        input: 'todo',
        expected: 'todo',
      },
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(UpdateIssueStatusByLabelUseCase.normalizeStatus(input)).toEqual(
          expected,
        );
      });
    });
  });

  describe('run', () => {
    const testCases: {
      name: string;
      issues: Issue[];
      expectedCalls: {
        updateStatus: [unknown, unknown, string][];
        removeLabel: [unknown, string][];
      };
    }[] = [
      {
        name: 'should not update when no issues have status label',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['bug', 'priority-high'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [],
        },
      },
      {
        name: 'should update status and remove label when status differs',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['bug', 'status:In Progress'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [[expect.anything(), expect.anything(), 'status2']],
          removeLabel: [[expect.anything(), 'status:In Progress']],
        },
      },
      {
        name: 'should remove label without updating when status already matches',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:ToDo'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [[expect.anything(), 'status:ToDo']],
        },
      },
      {
        name: 'should match status ignoring whitespace, hyphens, and underscores',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:in-progress'],
            status: 'In Progress',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [[expect.anything(), 'status:in-progress']],
        },
      },
      {
        name: 'should match status ignoring underscores',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:in_progress'],
            status: 'In Progress',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [[expect.anything(), 'status:in_progress']],
        },
      },
      {
        name: 'should skip when target status is not found in project statuses',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:Unknown Status'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [],
        },
      },
      {
        name: 'should handle multiple issues with status labels',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:In Progress'],
            status: 'ToDo',
          },
          {
            ...mock<Issue>(),
            labels: ['status:Icebox'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [
            [expect.anything(), expect.anything(), 'status2'],
            [expect.anything(), expect.anything(), 'status3'],
          ],
          removeLabel: [
            [expect.anything(), 'status:In Progress'],
            [expect.anything(), 'status:Icebox'],
          ],
        },
      },
      {
        name: 'should handle case-insensitive label prefix',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['Status:Icebox'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [[expect.anything(), expect.anything(), 'status3']],
          removeLabel: [[expect.anything(), 'Status:Icebox']],
        },
      },
      {
        name: 'should update status when issue has null status',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:ToDo'],
            status: null,
          },
        ],
        expectedCalls: {
          updateStatus: [[expect.anything(), expect.anything(), 'status1']],
          removeLabel: [[expect.anything(), 'status:ToDo']],
        },
      },
      {
        name: 'should process only the first status label found',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:In Progress', 'status:Icebox'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [[expect.anything(), expect.anything(), 'status2']],
          removeLabel: [[expect.anything(), 'status:In Progress']],
        },
      },
      {
        name: 'should handle empty issues array',
        issues: [],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [],
        },
      },
      {
        name: 'should not update when status label value does not match any project status',
        issues: [
          {
            ...mock<Issue>(),
            labels: ['status:UnknownStatus'],
            status: 'ToDo',
          },
        ],
        expectedCalls: {
          updateStatus: [],
          removeLabel: [],
        },
      },
    ];

    testCases.forEach(({ name, issues, expectedCalls }) => {
      it(name, async () => {
        await useCase.run({
          project: basicProject,
          issues,
        });

        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedCalls.updateStatus,
        );
        expect(mockIssueRepository.removeLabel.mock.calls).toEqual(
          expectedCalls.removeLabel,
        );
      });
    });

    it('should include issue url and label in error message when removeLabel fails', async () => {
      const issueWithUrl = {
        ...mock<Issue>(),
        labels: ['status:In Progress'],
        status: 'In Progress',
        url: 'https://github.com/testOrg/testRepo/issues/42',
      };
      mockIssueRepository.removeLabel.mockRejectedValueOnce(
        new Error('Request failed with status code 403 Forbidden'),
      );

      let caughtError: unknown;
      try {
        await useCase.run({
          project: basicProject,
          issues: [issueWithUrl],
        });
        throw new Error('expected run() to reject');
      } catch (e) {
        caughtError = e;
      }
      if (!(caughtError instanceof Error)) {
        throw new Error('Expected caughtError to be an Error instance');
      }
      expect(caughtError.message).toContain(
        'https://github.com/testOrg/testRepo/issues/42',
      );
      expect(caughtError.message).toContain('status:In Progress');
      expect(caughtError.message).toContain(
        'Request failed with status code 403 Forbidden',
      );
    });

    describe('stale project item isolation and failure aggregation (issue #2789)', () => {
      const staleIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/testOrg/testRepo/issues/901',
        itemId: 'item-stale-1',
        labels: ['status:In Progress'],
        status: 'ToDo',
      };
      const okIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/testOrg/testRepo/issues/902',
        itemId: 'item-ok-1',
        labels: ['status:Icebox'],
        status: 'ToDo',
      };

      it('skips an issue whose updateStatus call fails with StaleProjectItemError, logging it via console.warn with the issue url and stale item id, while the other issue in the same run is still processed', async () => {
        const consoleWarnSpy = jest
          .spyOn(console, 'warn')
          .mockImplementation(() => undefined);
        mockIssueRepository.updateStatus.mockImplementation(
          async (_project, issue) => {
            if (issue.url === staleIssue.url) {
              throw new StaleProjectItemError(staleIssue.itemId);
            }
          },
        );

        await useCase.run({
          project: basicProject,
          issues: [staleIssue, okIssue],
        });

        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status2'],
          [basicProject, okIssue, 'status3'],
        ]);
        expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
          [okIssue, 'status:Icebox'],
        ]);
        const warnedMessages = consoleWarnSpy.mock.calls.map((call) =>
          call.join(' '),
        );
        expect(
          warnedMessages.some((message) => message.includes(staleIssue.url)),
        ).toBe(true);
        expect(
          warnedMessages.some((message) =>
            message.includes(staleIssue.itemId),
          ),
        ).toBe(true);
        consoleWarnSpy.mockRestore();
      });

      it('collects a non-stale error from one issue, still processes the other issue, and surfaces one rejection naming the failing issue and the underlying error', async () => {
        const underlyingError = new Error('GitHub API rate limit exceeded');
        mockIssueRepository.updateStatus.mockImplementation(
          async (_project, issue) => {
            if (issue.url === staleIssue.url) {
              throw underlyingError;
            }
          },
        );

        const runPromise = useCase.run({
          project: basicProject,
          issues: [staleIssue, okIssue],
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
        expect(caughtError.message).toContain(staleIssue.url);
        expect(caughtError.message).toContain(underlyingError.message);
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status2'],
          [basicProject, okIssue, 'status3'],
        ]);
        expect(mockIssueRepository.removeLabel.mock.calls).toEqual([
          [okIssue, 'status:Icebox'],
        ]);
      });

      it('resolves normally when no exception occurs (no-op regression check)', async () => {
        mockIssueRepository.updateStatus.mockReset();
        mockIssueRepository.updateStatus.mockResolvedValue(undefined);

        await expect(
          useCase.run({
            project: basicProject,
            issues: [staleIssue, okIssue],
          }),
        ).resolves.toBeUndefined();
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status2'],
          [basicProject, okIssue, 'status3'],
        ]);
      });
    });
  });
});
