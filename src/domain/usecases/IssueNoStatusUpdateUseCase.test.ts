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

  const basicProject = {
    ...mock<Project>(),
    status: {
      name: 'Status',
      fieldId: 'statusFieldId',
      statuses: [awaitingWorkspaceStatus, inProgressStatus],
    },
  };

  const projectWithoutAwaitingWorkspace = {
    ...mock<Project>(),
    status: {
      name: 'Status',
      fieldId: 'statusFieldId',
      statuses: [inProgressStatus],
    },
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
      expectedUpdateStatusCalls: [unknown, unknown, string][];
    }[] = [
      {
        name: 'should call updateStatus for open issues with null status',
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            isClosed: false,
            status: null,
          },
        ],
        expectedUpdateStatusCalls: [
          [expect.anything(), expect.anything(), 'status-awaiting'],
        ],
      },
      {
        name: 'should skip issues with an existing status',
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            isClosed: false,
            status: 'In Progress',
          },
        ],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should skip closed issues with null status',
        project: basicProject,
        issues: [
          {
            ...mock<Issue>(),
            isClosed: true,
            status: null,
          },
        ],
        expectedUpdateStatusCalls: [],
      },
      {
        name: 'should not call updateStatus when Awaiting Workspace status does not exist in project',
        project: projectWithoutAwaitingWorkspace,
        issues: [
          {
            ...mock<Issue>(),
            isClosed: false,
            status: null,
          },
        ],
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
          {
            ...mock<Issue>(),
            isClosed: false,
            status: null,
          },
          {
            ...mock<Issue>(),
            isClosed: false,
            status: 'In Progress',
          },
          {
            ...mock<Issue>(),
            isClosed: true,
            status: null,
          },
        ],
        expectedUpdateStatusCalls: [
          [expect.anything(), expect.anything(), 'status-awaiting'],
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
  });
});
