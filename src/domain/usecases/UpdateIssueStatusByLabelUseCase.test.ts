import { mock } from 'jest-mock-extended';
import { UpdateIssueStatusByLabelUseCase } from './UpdateIssueStatusByLabelUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';

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
      defaultStatus: string | null;
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
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
        defaultStatus: null,
        expectedCalls: {
          updateStatus: [[expect.anything(), expect.anything(), 'status2']],
          removeLabel: [[expect.anything(), 'status:In Progress']],
        },
      },
      {
        name: 'should handle empty issues array',
        issues: [],
        defaultStatus: null,
        expectedCalls: {
          updateStatus: [],
          removeLabel: [],
        },
      },
    ];

    testCases.forEach(({ name, issues, defaultStatus, expectedCalls }) => {
      it(name, async () => {
        await useCase.run({
          project: basicProject,
          issues,
          defaultStatus,
        });

        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedCalls.updateStatus,
        );
        expect(mockIssueRepository.removeLabel.mock.calls).toEqual(
          expectedCalls.removeLabel,
        );
      });
    });
  });
});
