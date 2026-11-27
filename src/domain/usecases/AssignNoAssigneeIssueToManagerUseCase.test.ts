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
      name: 'should assign manager when cacheUsed is true',
      input: {
        issues: [basicIssue],
        manager: 'manager1',
        cacheUsed: true,
      },
      expectedCalls: {
        updateAssigneeList: [[expect.anything(), ['manager1']]],
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

    describe('issues matched by queryToAddProject with a project repository scope', () => {
      const project = { ...mock<Project>(), id: 'project-1' };
      const searchedIssueNonPr: SearchedIssue = {
        url: 'https://github.com/testOrg/testRepo/issues/11',
        org: 'testOrg',
        repo: 'testRepo',
        number: 11,
        state: 'OPEN',
        author: 'dependabot',
        assignees: [],
        isPr: false,
      };

      test.each([
        {
          case: 'a listed project adds a matched issue of its listed repository',
          projectScope: {
            org: 'testOrg',
            repositories: ['testOrg/testRepo'],
            listedRepositoriesOfOtherProjects: [],
            ownsUnlistedRepositoriesOfOwner: false,
          },
          expectedAdded: true,
        },
        {
          case: 'an unlisted project skips a matched issue of a repository listed by its sibling, ignoring case',
          projectScope: {
            org: 'testOrg',
            repositories: null,
            listedRepositoriesOfOtherProjects: ['testorg/testrepo'],
            ownsUnlistedRepositoriesOfOwner: false,
          },
          expectedAdded: false,
        },
        {
          case: 'an unlisted project with no sibling listing adds the matched issue as before',
          projectScope: {
            org: 'testOrg',
            repositories: null,
            listedRepositoriesOfOtherProjects: [],
            ownsUnlistedRepositoriesOfOwner: false,
          },
          expectedAdded: true,
        },
        {
          case: 'a listed project skips a matched issue of an unlisted repository when every same-owner project lists repositories',
          projectScope: {
            org: 'testOrg',
            repositories: ['testOrg/listed-repo'],
            listedRepositoriesOfOtherProjects: [],
            ownsUnlistedRepositoriesOfOwner: false,
          },
          expectedAdded: false,
        },
        {
          case: 'a listed project skips a matched issue of an unlisted repository when an unlisted sibling of its owner exists',
          projectScope: {
            org: 'testOrg',
            repositories: ['testOrg/listed-repo'],
            listedRepositoriesOfOtherProjects: [],
            ownsUnlistedRepositoriesOfOwner: false,
          },
          expectedAdded: false,
        },
      ])('$case', async ({ projectScope, expectedAdded }) => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          searchedIssueNonPr,
        ]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
          projectScope,
        });

        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual(
          expectedAdded ? [[project, searchedIssueNonPr.url]] : [],
        );
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual(
          expectedAdded
            ? [[{ org: 'testOrg', repo: 'testRepo', number: 11 }, ['manager1']]]
            : [],
        );
      });
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
        isPr: true,
      };
      const searchedIssueNonPr: SearchedIssue = {
        url: 'https://github.com/testOrg/testRepo/issues/11',
        org: 'testOrg',
        repo: 'testRepo',
        number: 11,
        state: 'OPEN',
        author: 'dependabot',
        assignees: [],
        isPr: false,
      };

      it('does not add a matched pull request to the project but still assigns the manager', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([searchedIssue]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          ['repo:testOrg/testRepo is:open no:project'],
        ]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [{ org: 'testOrg', repo: 'testRepo', number: 7 }, ['manager1']],
        ]);
      });

      it('adds a matched issue that is not a project item to the project and assigns the manager', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          searchedIssueNonPr,
        ]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          ['repo:testOrg/testRepo is:open no:project'],
        ]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
          [project, searchedIssueNonPr.url],
        ]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [{ org: 'testOrg', repo: 'testRepo', number: 11 }, ['manager1']],
        ]);
      });

      it('searches and does not add a matched pull request to the project when cacheUsed is true, but still assigns the manager', async () => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([searchedIssue]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: true,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          ['repo:testOrg/testRepo is:open no:project'],
        ]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
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
          queryToAddProjectEnabled: true,
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
          queryToAddProjectEnabled: true,
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
          queryToAddProjectEnabled: true,
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
          queryToAddProjectEnabled: true,
          queryToAddProject: null,
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([]);
      });

      it('does not search when queryToAddProjectEnabled is false', async () => {
        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: false,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      });

      it('does not search when queryToAddProjectEnabled is not configured', async () => {
        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          autoAssignManagerAuthors: ['dependabot'],
          projectToAddSearchedIssues: project,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      });

      it('logs and returns without throwing when the search fails', async () => {
        mockIssueRepository.searchIssues.mockRejectedValueOnce(
          new Error('Validation Failed'),
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
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to search issues by repo:testOrg/testRepo is:open no:project: Validation Failed',
        );
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);

        consoleErrorSpy.mockRestore();
      });

      it('logs and continues when adding a matched issue to the project fails', async () => {
        const secondNonPrMatch = {
          ...searchedIssueNonPr,
          url: 'https://github.com/testOrg/testRepo/issues/12',
          number: 12,
        };
        mockIssueRepository.searchIssues.mockResolvedValueOnce([
          searchedIssueNonPr,
          secondNonPrMatch,
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
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          `Failed to add issue ${searchedIssueNonPr.url} to project: Content not found`,
        );
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
          [{ org: 'testOrg', repo: 'testRepo', number: 12 }, ['manager1']],
        ]);

        consoleErrorSpy.mockRestore();
      });
    });

    it('should skip issues in archived repositories', async () => {
      const archivedIssue = {
        ...basicIssue,
        isRepoArchived: true,
      };

      await useCase.run({
        issues: [archivedIssue],
        manager: 'manager1',
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);
    });

    it('should assign manager to issues in non-archived repositories', async () => {
      const nonArchivedIssue = {
        ...basicIssue,
        isRepoArchived: false,
      };

      await useCase.run({
        issues: [nonArchivedIssue],
        manager: 'manager1',
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [nonArchivedIssue, ['manager1']],
      ]);
    });

    it('should assign manager to issues where isRepoArchived is undefined', async () => {
      const issueWithoutArchivedFlag = {
        ...basicIssue,
        isRepoArchived: undefined,
      };

      await useCase.run({
        issues: [issueWithoutArchivedFlag],
        manager: 'manager1',
        cacheUsed: false,
      });

      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([
        [issueWithoutArchivedFlag, ['manager1']],
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

  describe('queryToAddManagerAssignedIssues', () => {
    const project = { ...mock<Project>(), id: 'project-1' };
    const managerQuery =
      'repo:testOrg/testRepo is:issue is:open assignee:manager1 author:manager1';
    const matchedIssue: SearchedIssue = {
      url: 'https://github.com/testOrg/testRepo/issues/21',
      org: 'testOrg',
      repo: 'testRepo',
      number: 21,
      state: 'OPEN',
      author: 'manager1',
      assignees: ['manager1'],
      isPr: false,
    };
    const scopeListingTestRepo = {
      org: 'testOrg',
      repositories: ['testOrg/testRepo'],
      listedRepositoriesOfOtherProjects: [],
      ownsUnlistedRepositoriesOfOwner: false,
    };
    const scopeListingOtherRepo = {
      org: 'testOrg',
      repositories: ['testOrg/other-repo'],
      listedRepositoriesOfOtherProjects: [],
      ownsUnlistedRepositoriesOfOwner: false,
    };

    test.each([
      {
        case: 'adds an open issue authored and assigned to the manager',
        searched: {},
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: true,
      },
      {
        case: 'adds the issue when the project scope lists its repository',
        searched: {},
        isRepoArchived: false,
        onBoard: false,
        projectScope: scopeListingTestRepo,
        expectedAdded: true,
      },
      {
        case: 'skips a matched pull request',
        searched: { isPr: true },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips a closed issue',
        searched: { state: 'CLOSED' as const },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips a merged item',
        searched: { state: 'MERGED' as const },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue in an archived repository',
        searched: {},
        isRepoArchived: true,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue already on the project board',
        searched: {},
        isRepoArchived: false,
        onBoard: true,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue whose author is not the manager',
        searched: { author: 'someone-else' },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue with no assignee',
        searched: { assignees: [] },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue assigned only to someone other than the manager',
        searched: { assignees: ['someone-else'] },
        isRepoArchived: false,
        onBoard: false,
        projectScope: null,
        expectedAdded: false,
      },
      {
        case: 'skips an issue whose repository the project scope does not list',
        searched: {},
        isRepoArchived: false,
        onBoard: false,
        projectScope: scopeListingOtherRepo,
        expectedAdded: false,
      },
    ])(
      '$case',
      async ({
        searched,
        isRepoArchived,
        onBoard,
        projectScope,
        expectedAdded,
      }) => {
        const target: SearchedIssue = { ...matchedIssue, ...searched };
        mockIssueRepository.searchIssues.mockResolvedValueOnce([target]);
        mockIssueRepository.isRepositoryArchived.mockResolvedValue(
          isRepoArchived,
        );
        const boardItems = onBoard
          ? [{ ...basicIssue, url: target.url, assignees: ['manager1'] }]
          : [];
        const consoleLogSpy = jest
          .spyOn(console, 'log')
          .mockImplementation(() => undefined);

        await useCase.run({
          issues: boardItems,
          manager: 'manager1',
          cacheUsed: false,
          projectToAddSearchedIssues: project,
          queryToAddManagerAssignedIssues: managerQuery,
          projectScope,
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          [managerQuery],
        ]);
        expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual(
          expectedAdded ? [[project, target.url]] : [],
        );
        expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);

        consoleLogSpy.mockRestore();
      },
    );

    test.each([
      { case: 'absent', extra: {} },
      { case: 'null', extra: { queryToAddManagerAssignedIssues: null } },
    ])(
      'runs only the queryToAddProject search when the key is $case',
      async ({ extra }) => {
        mockIssueRepository.searchIssues.mockResolvedValueOnce([]);

        await useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          projectToAddSearchedIssues: project,
          queryToAddProjectEnabled: true,
          queryToAddProject: 'repo:testOrg/testRepo is:open no:project',
          ...extra,
        });

        expect(mockIssueRepository.searchIssues.mock.calls).toEqual([
          ['repo:testOrg/testRepo is:open no:project'],
        ]);
        expect(mockIssueRepository.isRepositoryArchived.mock.calls).toEqual([]);
      },
    );

    it('skips an issue authored by another login when addManagerAssignedIssuesFromAnyAuthor is false', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        { ...matchedIssue, author: 'automation-bot' },
      ]);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
        addManagerAssignedIssuesFromAnyAuthor: false,
      });

      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      consoleLogSpy.mockRestore();
    });

    it('adds an issue authored by another login and assigned to the manager when addManagerAssignedIssuesFromAnyAuthor is true', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        { ...matchedIssue, author: 'automation-bot' },
      ]);
      mockIssueRepository.isRepositoryArchived.mockResolvedValue(false);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
        addManagerAssignedIssuesFromAnyAuthor: true,
      });

      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
        [project, matchedIssue.url],
      ]);
      expect(mockIssueRepository.updateAssigneeList.mock.calls).toEqual([]);
      consoleLogSpy.mockRestore();
    });

    it('still skips an issue not assigned to the manager when addManagerAssignedIssuesFromAnyAuthor is true', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        {
          ...matchedIssue,
          author: 'automation-bot',
          assignees: ['someone-else'],
        },
      ]);
      mockIssueRepository.isRepositoryArchived.mockResolvedValue(false);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
        addManagerAssignedIssuesFromAnyAuthor: true,
      });

      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      consoleLogSpy.mockRestore();
    });

    it('logs the skip reason when the author is not the manager', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        { ...matchedIssue, author: 'someone-else' },
      ]);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Skipped issue ${matchedIssue.url}: author someone-else is not manager1`,
      );
      consoleLogSpy.mockRestore();
    });

    it('logs the skip reason when the author is not the manager and the manager is not assigned', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        { ...matchedIssue, author: 'someone-else', assignees: [] },
      ]);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Skipped issue ${matchedIssue.url}: author someone-else is not manager1`,
      );
      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      consoleLogSpy.mockRestore();
    });

    it('logs the skip reason when the project scope does not list the repository', async () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockResolvedValueOnce([matchedIssue]);
      mockIssueRepository.isRepositoryArchived.mockResolvedValue(false);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
        projectScope: scopeListingOtherRepo,
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Skipped issue ${matchedIssue.url}: repository testOrg/testRepo is outside the project scope`,
      );
      consoleLogSpy.mockRestore();
    });

    it('checks the archived state once per repository within a run', async () => {
      const secondIssue: SearchedIssue = {
        ...matchedIssue,
        url: 'https://github.com/testOrg/testRepo/issues/22',
        number: 22,
      };
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        matchedIssue,
        secondIssue,
      ]);
      mockIssueRepository.isRepositoryArchived.mockResolvedValue(false);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
      });

      expect(mockIssueRepository.isRepositoryArchived.mock.calls).toEqual([
        ['testOrg', 'testRepo'],
      ]);
      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
        [project, matchedIssue.url],
        [project, secondIssue.url],
      ]);
    });

    it('logs the query and continues when the manager-assigned search fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      mockIssueRepository.searchIssues.mockRejectedValueOnce(
        new Error('rate limited'),
      );

      await expect(
        useCase.run({
          issues: [],
          manager: 'manager1',
          cacheUsed: false,
          projectToAddSearchedIssues: project,
          queryToAddManagerAssignedIssues: managerQuery,
        }),
      ).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to search issues by ${managerQuery}: rate limited`,
      );
      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([]);
      consoleErrorSpy.mockRestore();
    });

    it('logs the URL and continues with remaining issues when adding one fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const secondIssue: SearchedIssue = {
        ...matchedIssue,
        url: 'https://github.com/testOrg/testRepo/issues/23',
        number: 23,
      };
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        matchedIssue,
        secondIssue,
      ]);
      mockIssueRepository.isRepositoryArchived.mockResolvedValue(false);
      mockIssueRepository.addIssueToProject.mockRejectedValueOnce(
        new Error('Content not found'),
      );

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to add issue ${matchedIssue.url} to project: Content not found`,
      );
      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
        [project, matchedIssue.url],
        [project, secondIssue.url],
      ]);
      consoleErrorSpy.mockRestore();
    });

    it('logs the URL and continues with remaining issues when the archived check fails', async () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const otherRepoIssue: SearchedIssue = {
        ...matchedIssue,
        url: 'https://github.com/testOrg/other-repo/issues/31',
        repo: 'other-repo',
        number: 31,
      };
      mockIssueRepository.searchIssues.mockResolvedValueOnce([
        matchedIssue,
        otherRepoIssue,
      ]);
      mockIssueRepository.isRepositoryArchived
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce(false);

      await useCase.run({
        issues: [],
        manager: 'manager1',
        cacheUsed: false,
        projectToAddSearchedIssues: project,
        queryToAddManagerAssignedIssues: managerQuery,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        `Failed to check whether repository of ${matchedIssue.url} is archived: Not Found`,
      );
      expect(mockIssueRepository.addIssueToProject.mock.calls).toEqual([
        [project, otherRepoIssue.url],
      ]);
      consoleErrorSpy.mockRestore();
    });
  });
});
