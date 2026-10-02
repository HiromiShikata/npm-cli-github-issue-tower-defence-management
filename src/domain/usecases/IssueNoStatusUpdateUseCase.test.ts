import { mock } from 'jest-mock-extended';
import { IssueNoStatusUpdateUseCase } from './IssueNoStatusUpdateUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project } from '../entities/Project';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

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
    mockIssueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      isClosed: false,
      status: null,
    });
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

    describe('when updateStatus rejects with StaleProjectItemError for one issue', () => {
      const staleIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/org/repo/issues/stale-project-item',
        itemId: 'stale-item-id',
        isClosed: false,
        status: null,
      };
      const remainingIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/org/repo/issues/remaining-after-stale',
        itemId: 'remaining-item-id',
        isClosed: false,
        status: null,
      };
      let warnSpy: jest.SpyInstance;

      beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        mockIssueRepository.updateStatus.mockImplementation(
          async (_project, issue) => {
            if (issue.url === staleIssue.url) {
              throw new StaleProjectItemError('item-id');
            }
          },
        );
      });

      afterEach(() => {
        warnSpy.mockRestore();
        mockIssueRepository.updateStatus.mockReset();
      });

      it('skips the stale issue with a warning naming its url and still updates the remaining issue without throwing', async () => {
        await expect(
          useCase.run({
            project: basicProject,
            issues: [staleIssue, remainingIssue],
          }),
        ).resolves.toBeUndefined();

        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status-awaiting'],
          [basicProject, remainingIssue, 'status-awaiting'],
        ]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(staleIssue.url),
        );
      });
    });

    describe('when the Status changed after the item snapshot was taken', () => {
      const snapshotIssueUrl =
        'https://github.com/org/repo/issues/snapshot-status-empty';
      const snapshotIssue: Issue = {
        ...mock<Issue>(),
        url: snapshotIssueUrl,
        isClosed: false,
        status: null,
      };

      it.each<{
        label: string;
        liveIssue: Issue | null;
        expectedUpdateStatusCalls: [Project, Issue, string][];
      }>([
        {
          label:
            'does not overwrite a Status an agent set after the snapshot was taken',
          liveIssue: { ...snapshotIssue, status: 'In Tmux by agent' },
          expectedUpdateStatusCalls: [],
        },
        {
          label: 'does not write when the item is no longer on the project',
          liveIssue: null,
          expectedUpdateStatusCalls: [],
        },
        {
          label:
            'writes Awaiting Workspace when the live Status is still empty',
          liveIssue: { ...snapshotIssue },
          expectedUpdateStatusCalls: [
            [basicProject, snapshotIssue, 'status-awaiting'],
          ],
        },
      ])('$label', async ({ liveIssue, expectedUpdateStatusCalls }) => {
        mockIssueRepository.get.mockResolvedValue(liveIssue);

        await useCase.run({ project: basicProject, issues: [snapshotIssue] });

        expect(mockIssueRepository.get.mock.calls).toEqual([
          [snapshotIssueUrl, basicProject],
        ]);
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedUpdateStatusCalls,
        );
      });
    });
  });
});
