import { mock } from 'jest-mock-extended';
import { IssueNoStatusUpdateUseCase } from './IssueNoStatusUpdateUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';

describe('IssueNoStatusUpdateUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();

  const awaitingWorkspaceStatus = mock<FieldOption>();
  awaitingWorkspaceStatus.id = 'status-awaiting';
  awaitingWorkspaceStatus.name = 'Awaiting Workspace';

  const inProgressStatus = mock<FieldOption>();
  inProgressStatus.id = 'status-in-progress';
  inProgressStatus.name = 'In Progress';

  const basicProject: Project = {
    ...mock<Project>(),
    status: {
      name: 'Status',
      fieldId: 'statusFieldId',
      statuses: [awaitingWorkspaceStatus, inProgressStatus],
    },
  };

  const projectWithoutAwaitingWorkspace: Project = {
    ...mock<Project>(),
    status: {
      name: 'Status',
      fieldId: 'statusFieldId',
      statuses: [inProgressStatus],
    },
  };

  const openNullStatusIssue: Issue = {
    ...mock<Issue>(),
    isClosed: false,
    status: null,
  };

  const openInProgressIssue: Issue = {
    ...mock<Issue>(),
    isClosed: false,
    status: 'In Progress',
  };

  const closedNullStatusIssue: Issue = {
    ...mock<Issue>(),
    isClosed: true,
    status: null,
  };

  let useCase: IssueNoStatusUpdateUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new IssueNoStatusUpdateUseCase(mockIssueRepository);
  });

  describe('run', () => {
    const testCases: {
      name: string;
      project: Project;
      issues: Issue[];
      expectedUpdateStatusCalls: [Project, Issue, string][];
    }[] = [
      {
        name: 'should call updateStatus for open issues with null status',
        project: basicProject,
        issues: [openNullStatusIssue],
        expectedUpdateStatusCalls: [
          [basicProject, openNullStatusIssue, 'status-awaiting'],
        ],
      },
      {
        name: 'should skip issues with an existing status',
        project: basicProject,
        issues: [openInProgressIssue],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should skip closed issues with null status',
        project: basicProject,
        issues: [closedNullStatusIssue],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should not call updateStatus when Awaiting Workspace status does not exist in project',
        project: projectWithoutAwaitingWorkspace,
        issues: [openNullStatusIssue],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should handle empty issues array',
        project: basicProject,
        issues: [],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should call updateStatus only for open null-status issues among mixed issues',
        project: basicProject,
        issues: [
          openNullStatusIssue,
          openInProgressIssue,
          closedNullStatusIssue,
        ],
        expectedUpdateStatusCalls: [
          [basicProject, openNullStatusIssue, 'status-awaiting'],
        ],
      },
    ];

    testCases.forEach(
      ({ name, project, issues, expectedUpdateStatusCalls }) => {
        it(name, async () => {
          await useCase.run({ project, issues });

          expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
            expectedUpdateStatusCalls,
          );
        });
      },
    );

    it('should skip archived items and continue updating remaining issues', async () => {
      const archivedIssue: Issue = {
        ...mock<Issue>(),
        isClosed: false,
        status: null,
      };
      const normalIssue: Issue = {
        ...mock<Issue>(),
        isClosed: false,
        status: null,
      };

      mockIssueRepository.updateStatus
        .mockRejectedValueOnce(
          new Error('The item is archived and cannot be updated'),
        )
        .mockResolvedValueOnce(undefined);

      await useCase.run({
        project: basicProject,
        issues: [archivedIssue, normalIssue],
      });

      expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
        [basicProject, archivedIssue, 'status-awaiting'],
        [basicProject, normalIssue, 'status-awaiting'],
      ]);
    });

    it('should re-throw non-archived errors from updateStatus', async () => {
      mockIssueRepository.updateStatus.mockRejectedValueOnce(
        new Error('GraphQL rate limit exceeded'),
      );

      await expect(
        useCase.run({ project: basicProject, issues: [openNullStatusIssue] }),
      ).rejects.toThrow('GraphQL rate limit exceeded');
    });
  });
});
