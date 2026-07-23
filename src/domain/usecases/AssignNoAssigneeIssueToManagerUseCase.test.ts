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

    it('should log error and continue to next issue when updateAssigneeList fails', async () => {
      const failingIssue = {
        ...basicIssue,
        url: 'https://github.com/testOrg/testRepo/issues/42',
      };
      const subsequentIssue = {
        ...basicIssue,
        url: 'https://github.com/testOrg/testRepo/issues/43',
      };
      mockIssueRepository.updateAssigneeList.mockRejectedValueOnce(
        new Error('Request failed with status code 403 Forbidden'),
      );
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      await expect(
        useCase.run({
          issues: [failingIssue, subsequentIssue],
          manager: 'manager1',
          cacheUsed: false,
        }),
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to update assignee for issue https://github.com/testOrg/testRepo/issues/42: Request failed with status code 403 Forbidden',
      );
      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [failingIssue, ['manager1']],
        [subsequentIssue, ['manager1']],
      ]);

      consoleErrorSpy.mockRestore();
    });

    it('should assign only issues whose author is in autoAssignManagerAuthors', async () => {
      const allowedIssue = {
        ...basicIssue,
        author: 'renovate[bot]',
      };
      const disallowedIssue = {
        ...basicIssue,
        author: 'human-author',
      };

      await useCase.run({
        issues: [allowedIssue, disallowedIssue],
        manager: 'manager1',
        cacheUsed: false,
        autoAssignManagerAuthors: ['renovate[bot]'],
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [allowedIssue, ['manager1']],
      ]);
    });

    it('should assign only listed authors in a mixed-author set', async () => {
      const renovateIssue = {
        ...basicIssue,
        author: 'renovate[bot]',
      };
      const humanIssue = {
        ...basicIssue,
        author: 'human-author',
      };
      const dependabotIssue = {
        ...basicIssue,
        author: 'dependabot[bot]',
      };

      await useCase.run({
        issues: [renovateIssue, humanIssue, dependabotIssue],
        manager: 'manager1',
        cacheUsed: false,
        autoAssignManagerAuthors: ['renovate[bot]', 'dependabot[bot]'],
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [renovateIssue, ['manager1']],
        [dependabotIssue, ['manager1']],
      ]);
    });

    it('should assign all unassigned issues when autoAssignManagerAuthors is null', async () => {
      const firstIssue = {
        ...basicIssue,
        author: 'renovate[bot]',
      };
      const secondIssue = {
        ...basicIssue,
        author: 'human-author',
      };

      await useCase.run({
        issues: [firstIssue, secondIssue],
        manager: 'manager1',
        cacheUsed: false,
        autoAssignManagerAuthors: null,
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [firstIssue, ['manager1']],
        [secondIssue, ['manager1']],
      ]);
    });

    it('should assign all unassigned issues when autoAssignManagerAuthors is an empty array', async () => {
      const firstIssue = {
        ...basicIssue,
        author: 'renovate[bot]',
      };
      const secondIssue = {
        ...basicIssue,
        author: 'human-author',
      };

      await useCase.run({
        issues: [firstIssue, secondIssue],
        manager: 'manager1',
        cacheUsed: false,
        autoAssignManagerAuthors: [],
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [firstIssue, ['manager1']],
        [secondIssue, ['manager1']],
      ]);
    });

    it('should rethrow non-Error thrown values without logging', async () => {
      const failingIssue = {
        ...basicIssue,
        url: 'https://github.com/testOrg/testRepo/issues/44',
      };
      const nonErrorValue: unknown = 'string-failure';
      mockIssueRepository.updateAssigneeList.mockImplementationOnce(() => {
        throw nonErrorValue;
      });

      await expect(
        useCase.run({
          issues: [failingIssue],
          manager: 'manager1',
          cacheUsed: false,
        }),
      ).rejects.toBe('string-failure');
    });
  });
});
