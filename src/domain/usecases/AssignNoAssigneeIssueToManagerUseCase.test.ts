import { mock } from 'jest-mock-extended';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';

describe('AssignNoAssigneeIssueToManagerUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  const basicIssue = {
    ...mock<Issue>(),
    assignees: [],
    state: 'OPEN' as const,
  };

  const useCase = new AssignNoAssigneeIssueToManagerUseCase(
    mockIssueRepository,
  );

  const testCases = [
    {
      name: 'should assign manager to issue with no assignees',
      input: {
        issues: [basicIssue],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [[expect.anything(), ['manager1']]],
      },
    },
    {
      name: 'should skip issues that already have assignees',
      input: {
        issues: [
          {
            ...basicIssue,
            assignees: ['user1'],
          },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [],
      },
    },
    {
      name: 'should skip closed issues',
      input: {
        issues: [
          {
            ...basicIssue,
            state: 'CLOSED' as const,
          },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [],
      },
    },
    {
      name: 'should skip merged issues',
      input: {
        issues: [
          {
            ...basicIssue,
            state: 'MERGED' as const,
          },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [],
      },
    },
    {
      name: 'should skip all operations when cache is used',
      input: {
        issues: [basicIssue],
        manager: 'manager1',
        cacheUsed: true,
      },
      expectedCalls: {
        updateAssigneeList: [],
      },
    },
    {
      name: 'should process multiple issues with no assignees',
      input: {
        issues: [
          basicIssue,
          {
            ...basicIssue,
            number: 2,
          },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [
          [expect.anything(), ['manager1']],
          [expect.anything(), ['manager1']],
        ],
      },
    },
    {
      name: 'should only assign to open issues without assignees',
      input: {
        issues: [
          basicIssue,
          {
            ...basicIssue,
            assignees: ['user1'],
          },
          {
            ...basicIssue,
            state: 'CLOSED' as const,
          },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      expectedCalls: {
        updateAssigneeList: [[expect.anything(), ['manager1']]],
      },
    },
  ];

  const errorTestCases = [
    {
      name: 'should warn and skip issue when updateAssigneeList throws an error',
      input: {
        issues: [basicIssue],
        manager: 'manager1',
        cacheUsed: false,
      },
      setupMock: () => {
        mockIssueRepository.updateAssigneeList.mockRejectedValueOnce(
          new Error('Request failed with status code 403'),
        );
      },
      expectedWarning:
        /Failed to assign manager to issue .+: Request failed with status code 403/,
    },
    {
      name: 'should continue processing remaining issues after error',
      input: {
        issues: [
          { ...basicIssue, url: 'https://github.com/org/repo1/issues/1' },
          { ...basicIssue, url: 'https://github.com/org/repo2/issues/2' },
        ],
        manager: 'manager1',
        cacheUsed: false,
      },
      setupMock: () => {
        mockIssueRepository.updateAssigneeList.mockRejectedValueOnce(
          new Error('Request failed with status code 403'),
        );
        mockIssueRepository.updateAssigneeList.mockResolvedValueOnce(undefined);
      },
      expectedCalls: {
        updateAssigneeList: [
          [expect.anything(), ['manager1']],
          [expect.anything(), ['manager1']],
        ],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('run', () => {
    testCases.forEach(({ name, input, expectedCalls }) => {
      it(name, async () => {
        await useCase.run(input);

        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual(
          expectedCalls.updateAssigneeList,
        );
      });
    });

    errorTestCases.forEach(
      ({ name, input, setupMock, expectedWarning, expectedCalls }) => {
        it(name, async () => {
          const consoleWarnSpy = jest
            .spyOn(console, 'warn')
            .mockImplementation();
          setupMock();

          await useCase.run(input);

          if (expectedWarning) {
            expect(consoleWarnSpy).toHaveBeenCalledWith(
              expect.stringMatching(expectedWarning),
            );
          }
          if (expectedCalls) {
            expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual(
              expectedCalls.updateAssigneeList,
            );
          }

          consoleWarnSpy.mockRestore();
        });
      },
    );
  });
});
