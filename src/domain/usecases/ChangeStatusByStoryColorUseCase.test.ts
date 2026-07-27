import { mock } from 'jest-mock-extended';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project, StoryOption } from '../entities/Project';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';

describe('ChangeStatusByStoryColorUseCase', () => {
  const mockDateRepository = mock<DateRepository>();
  const mockIssueRepository = mock<IssueRepository>();

  const manager = 'manager-user';
  const nonManagerAssignee = 'human-owner';

  const mockStatus = mock<FieldOption>();
  mockStatus.id = 'status1';
  mockStatus.name = 'ToDo';

  const mockReviewStatus = mock<FieldOption>();
  mockReviewStatus.id = 'status2';
  mockReviewStatus.name = 'InReview';

  const mockIceboxStatus = mock<FieldOption>();
  mockIceboxStatus.id = 'status3';
  mockIceboxStatus.name = 'Icebox';

  const basicProject = {
    ...mock<Project>(),
    story: {
      name: 'Story Field',
      fieldId: 'storyFieldId',
      databaseId: 1,
      stories: [
        { ...mock<StoryOption>(), id: 'story1', name: 'Story 1' },
        { ...mock<StoryOption>(), id: 'story2', name: 'Story 2' },
        { ...mock<StoryOption>(), id: 'regular3', name: 'regular / Story 3' },
      ],
      workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
    },
    status: {
      name: 'Status Field',
      fieldId: 'statusFieldId',
      statuses: [mockStatus, mockReviewStatus, mockIceboxStatus],
    },
  };

  const basicStoryIssue1 = {
    ...mock<Issue>(),
    title: 'Story 1',
    number: 123,
    body: `- [ ] Task 1
- [ ] Task 2`,
    url: 'https://github.com/org/repo/issues/123',
  };

  const basicStoryIssue2 = {
    ...mock<Issue>(),
    title: 'Story 2',
    number: 456,
    body: `- [ ] Task 3
- [ ] Task 4`,
    url: 'https://github.com/org/repo/issues/456',
  };
  const basicIssue1 = {
    ...mock<Issue>(),
    title: 'Issue 1',
    number: 789,
    status: 'Unread',
    assignees: [],
  };
  const basicIssue2 = {
    ...mock<Issue>(),
    title: 'Issue 2',
    number: 101,
    status: 'In Progres',
    assignees: [],
  };

  const basicStoryObject1: StoryObject = {
    story: {
      ...mock<StoryOption>(),
      id: 'story1',
      name: 'Story 1',
      color: 'RED',
    },
    storyIssue: basicStoryIssue1,
    issues: [basicIssue1],
  };
  const basicStoryObject2: StoryObject = {
    story: {
      ...mock<StoryOption>(),
      id: 'story2',
      name: 'Story 2',
      color: 'BLUE',
    },
    storyIssue: basicStoryIssue2,
    issues: [basicIssue2],
  };

  const basicStoryObjectMap: StoryObjectMap = new Map([
    ['Story 1', basicStoryObject1],
    ['Story 2', basicStoryObject2],
  ]);

  const useCase = new ChangeStatusByStoryColorUseCase(
    mockDateRepository,
    mockIssueRepository,
  );

  const testCases: {
    name: string;
    input: Parameters<ChangeStatusByStoryColorUseCase['run']>[0];
    expectedCalls: {
      createComment: [unknown, string][];
      updateStatus: [unknown, unknown, string][];
    };
  }[] = [
    {
      name: `should no update when status is correct`,
      input: {
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        storyObjectMap: basicStoryObjectMap,
        manager,
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: `should no update when cacheUsed`,
      input: {
        project: basicProject,
        cacheUsed: true,
        org: 'testOrg',
        repo: 'testRepo',
        storyObjectMap: basicStoryObjectMap,
        manager,
      },
      expectedCalls: {
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: `should update status with comment when story color is gray.`,
      input: {
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        storyObjectMap: new Map([
          [
            'Story 1',
            {
              ...basicStoryObject1,
              story: {
                ...basicStoryObject1.story,
                color: 'GRAY',
              },
            },
          ],
          ['Story 2', basicStoryObject2],
        ]),
        manager,
      },
      expectedCalls: {
        createComment: [
          [
            expect.anything(),
            'This issue status is changed because the story is disabled.',
          ],
        ],
        updateStatus: [[expect.anything(), expect.anything(), 'status3']],
      },
    },
    {
      name: `should update status with comment when story color is not gray`,
      input: {
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        storyObjectMap: new Map([
          [
            'Story 1',
            {
              ...basicStoryObject1,
              issues: [
                {
                  ...basicStoryObject1.issues[0],
                  status: 'Icebox',
                },
              ],
            },
          ],
          ['Story 2', basicStoryObject2],
        ]),
        manager,
      },
      expectedCalls: {
        createComment: [
          [
            expect.anything(),
            'This issue status is changed because the story is enabled.',
          ],
        ],
        updateStatus: [[expect.anything(), expect.anything(), 'status1']],
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockDateRepository.now.mockResolvedValue(new Date('2000-01-01T00:00:00Z'));
  });

  describe('run', () => {
    testCases.forEach(({ name, input, expectedCalls }) => {
      it(name, async () => {
        await useCase.run(input);

        expect(mockIssueRepository.createComment.mock.calls).toEqual(
          expectedCalls.createComment,
        );
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedCalls.updateStatus,
        );
      });
    });

    it('should throw error when project has no statuses', async () => {
      const mockStatusWithNoStatuses = mock<Project['status']>();
      mockStatusWithNoStatuses.name = 'Status';
      mockStatusWithNoStatuses.fieldId = 'status_field';
      mockStatusWithNoStatuses.statuses = [];

      const projectWithNoStatus = {
        ...basicProject,
        status: mockStatusWithNoStatuses,
      };

      await expect(
        useCase.run({
          project: projectWithNoStatus,
          cacheUsed: false,
          org: 'testOrg',
          repo: 'testRepo',
          storyObjectMap: basicStoryObjectMap,
          manager,
        }),
      ).rejects.toThrow('First status is not found');
    });
  });

  describe('first status assignment for an issue with no status', () => {
    const activeStory = {
      ...mock<StoryOption>(),
      id: 'story1',
      name: 'Story 1',
      color: 'RED' as const,
    };

    const buildStoryObjectMap = (issue: Issue): StoryObjectMap =>
      new Map([
        [
          'Story 1',
          {
            ...basicStoryObject1,
            story: activeStory,
            issues: [issue],
          },
        ],
      ]);

    const runInput = (issue: Issue) => ({
      project: basicProject,
      cacheUsed: false,
      org: 'testOrg',
      repo: 'testRepo',
      storyObjectMap: buildStoryObjectMap(issue),
      manager,
    });

    it('should set the first status on an issue with no status whose only assignee is the manager', async () => {
      const managerAssignedIssueWithoutStatus: Issue = {
        ...basicIssue1,
        status: null,
        assignees: [manager],
      };

      await useCase.run(runInput(managerAssignedIssueWithoutStatus));

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        basicProject,
        managerAssignedIssueWithoutStatus,
        'status1',
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        managerAssignedIssueWithoutStatus,
        'This issue status is changed because the story is enabled.',
      );
    });

    it('should not set the first status on an issue with no status that is assigned to someone other than the manager', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const humanAssignedIssueWithoutStatus: Issue = {
        ...basicIssue1,
        url: 'https://github.com/org/repo/issues/789',
        status: null,
        assignees: [nonManagerAssignee],
      };

      await useCase.run(runInput(humanAssignedIssueWithoutStatus));

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `ChangeStatusByStoryColorUseCase: skipping the first status write because the issue has no status and is assigned to someone other than the manager. issueUrl: https://github.com/org/repo/issues/789 assignees: ${nonManagerAssignee}`,
      );
      consoleWarnSpy.mockRestore();
    });

    it('should not set the first status on an issue with no status assigned to both the manager and another person', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const coAssignedIssueWithoutStatus: Issue = {
        ...basicIssue1,
        status: null,
        assignees: [manager, nonManagerAssignee],
      };

      await useCase.run(runInput(coAssignedIssueWithoutStatus));

      expect(mockIssueRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });

    it('should set the first status on an issue with no status that has no assignee', async () => {
      const unassignedIssueWithoutStatus: Issue = {
        ...basicIssue1,
        status: null,
        assignees: [],
      };

      await useCase.run(runInput(unassignedIssueWithoutStatus));

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        basicProject,
        unassignedIssueWithoutStatus,
        'status1',
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        unassignedIssueWithoutStatus,
        'This issue status is changed because the story is enabled.',
      );
    });
  });

  describe('icebox exit when the story is enabled', () => {
    const activeStory = {
      ...mock<StoryOption>(),
      id: 'story1',
      name: 'Story 1',
      color: 'RED' as const,
    };

    const buildStoryObjectMap = (issue: Issue): StoryObjectMap =>
      new Map([
        [
          'Story 1',
          {
            ...basicStoryObject1,
            story: activeStory,
            issues: [issue],
          },
        ],
      ]);

    const runInput = (issue: Issue) => ({
      project: basicProject,
      cacheUsed: false,
      org: 'testOrg',
      repo: 'testRepo',
      storyObjectMap: buildStoryObjectMap(issue),
      manager,
    });

    it('should move an Icebox issue that is assigned to someone other than the manager to the first status', async () => {
      const assignedIceboxIssue: Issue = {
        ...basicIssue1,
        status: 'Icebox',
        assignees: [nonManagerAssignee],
      };

      await useCase.run(runInput(assignedIceboxIssue));

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        basicProject,
        assignedIceboxIssue,
        'status1',
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        assignedIceboxIssue,
        'This issue status is changed because the story is enabled.',
      );
    });

    it('should move an Icebox issue that has no assignee to the first status', async () => {
      const unassignedIceboxIssue: Issue = {
        ...basicIssue1,
        status: 'Icebox',
        assignees: [],
      };

      await useCase.run(runInput(unassignedIceboxIssue));

      expect(mockIssueRepository.updateStatus).toHaveBeenCalledWith(
        basicProject,
        unassignedIceboxIssue,
        'status1',
      );
      expect(mockIssueRepository.createComment).toHaveBeenCalledWith(
        unassignedIceboxIssue,
        'This issue status is changed because the story is enabled.',
      );
    });
  });
});
