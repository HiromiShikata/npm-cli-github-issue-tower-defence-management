import { mock } from 'jest-mock-extended';
import { AssignNoAssigneeIssueToManagerUseCase } from './AssignNoAssigneeIssueToManagerUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { SearchedIssue } from '../entities/SearchedIssue';

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

    describe('issues matched by queryToAddProject', () => {
      const project = { ...mock<Project>(), id: 'project-1' };
      const searchedIssue: SearchedIssue = {
        url: 'https://github.com/testOrg/testRepo/pull/7',
        org: 'testOrg',
        repo: 'testRepo',
        number: 7,
        state: 'OPEN',
        author: 'dependabot',
        assignees: [],
      };

      it('adds a matched issue that is not a project item to the project and assigns the manager', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([searchedIssue]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          ['repo:testOrg/testRepo is:open no:project'],
        ]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
          [project, searchedIssue.url],
        ]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [{ org: 'testOrg', repo: 'testRepo', number: 7 }, ['manager1']],
        ]);
      });

      it('does not add or assign a matched issue whose author is outside autoAssignManagerAuthors', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          { ...searchedIssue, author: 'human-author' },
        ]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);
      });

      it('does not add or assign a matched issue that already has an assignee or is not open', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          { ...searchedIssue, assignees: ['someone'] },
          { ...searchedIssue, number: 8, state: 'CLOSED' },
        ]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);
      });

      it('assigns a matched issue that is already a project item only once and does not re-add it', async () => {
        const projectItem = {
          ...basicIssue,
          url: searchedIssue.url,
          author: 'dependabot',
        };
        mockIssueRepository.searchIssues.mockResolvedValueOnce([searchedIssue]);

        await useCase.run({
          issues: [projectItem],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [projectItem, ['manager1']],
        ]);
      });

      it('does not search when no query is configured', async () => {
        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: null,
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([]);
      });

      it('logs and continues when adding a matched issue to the project fails', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          searchedIssue,
          {
            ...searchedIssue,
            url: 'https://github.com/testOrg/testRepo/pull/9',
            number: 9,
          },
        ]);
        mockIssueRepository.addIssueToProject.mockRejectedValueOnce(
          new Error('Content not found'),
        );
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to add issue https://github.com/testOrg/testRepo/pull/7 to project: Content not found',
        );
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [{ org: 'testOrg', repo: 'testRepo', number: 9 }, ['manager1']],
        ]);

        consoleErrorSpy.mockRestore();
      });
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
