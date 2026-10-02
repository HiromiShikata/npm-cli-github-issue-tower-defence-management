import { mock } from 'jest-mock-extended';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project, StoryOption } from '../entities/Project';
import { StoryObject, StoryObjectMap } from '../entities/StoryObjectMap';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

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
      name: `moves an issue to Icebox when its story is disabled, regardless of fetch cadence`,
      input: {
        project: basicProject,
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
      name: `should not write again when an issue under a disabled story is already in Icebox`,
      input: {
        project: basicProject,
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
        createComment: [],
        updateStatus: [],
      },
    },
    {
      name: `should update status with comment when story color is gray.`,
      input: {
        project: basicProject,
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
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    mockIssueRepository.get.mockResolvedValue({
      ...mock<Issue>(),
      status: null,
      story: 'Story 1',
    });
  });

  describe('run', () => {
    testCases.forEach(({ name, input, expectedCalls }) => {
      it(name, async () => {
        mockIssueRepository.get.mockResolvedValue(
          input.storyObjectMap.get('Story 1')?.issues[0] ?? null,
        );
        await useCase.run(input);

        expect(mockIssueRepository.createComment.mock.calls).toEqual(
          expectedCalls.createComment,
        );
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedCalls.updateStatus,
        );
      });
    });

    it('should retry once and succeed when createComment first fails with a transient 502 error, backing off via the injected sleep before retrying', async () => {
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new ChangeStatusByStoryColorUseCase(
        mockDateRepository,
        mockIssueRepository,
        mockSleep,
      );
      mockIssueRepository.get.mockResolvedValue(basicStoryObject1.issues[0]);
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createComment
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(undefined);

      await retryingUseCase.run({
        project: basicProject,
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
      });

      expect(mockIssueRepository.createComment).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });

    it('should not re-post when createComment first fails with a transient 502 error and a duplicate comment is found on re-check', async () => {
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new ChangeStatusByStoryColorUseCase(
        mockDateRepository,
        mockIssueRepository,
        mockSleep,
      );
      mockIssueRepository.get.mockResolvedValue(basicStoryObject1.issues[0]);
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createComment.mockRejectedValueOnce(transientError);
      mockIssueRepository.getIssueOrPullRequestComments
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            author: 'bot',
            body: 'This issue status is changed because the story is disabled.',
            createdAt: new Date(),
          },
        ]);

      await retryingUseCase.run({
        project: basicProject,
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
      });

      expect(mockIssueRepository.createComment).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledTimes(1);
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
          org: 'testOrg',
          repo: 'testRepo',
          storyObjectMap: basicStoryObjectMap,
          manager,
        }),
      ).rejects.toThrow('First status is not found');
    });

    describe('stale project item isolation and failure aggregation (issue #2789)', () => {
      const staleIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/org/repo/issues/901',
        itemId: 'item-stale-1',
        status: null,
        story: 'Story X',
        assignees: [manager],
      };
      const okIssue: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/org/repo/issues/902',
        itemId: 'item-ok-1',
        status: null,
        story: 'Story X',
        assignees: [manager],
      };
      const storyIssueX = {
        ...mock<Issue>(),
        title: 'Story X',
        url: 'https://github.com/org/repo/issues/900',
      };
      const isolationStoryObjectMap: StoryObjectMap = new Map([
        [
          'Story X',
          {
            story: {
              ...mock<StoryOption>(),
              id: 'storyX',
              name: 'Story X',
              color: 'BLUE',
            },
            storyIssue: storyIssueX,
            issues: [staleIssue, okIssue],
          },
        ],
      ]);

      beforeEach(() => {
        mockIssueRepository.updateStatus.mockReset();
        mockIssueRepository.get.mockImplementation(async (url) => {
          if (url === staleIssue.url) return staleIssue;
          if (url === okIssue.url) return okIssue;
          return null;
        });
      });

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
          org: 'testOrg',
          repo: 'testRepo',
          storyObjectMap: isolationStoryObjectMap,
          manager,
        });

        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status1'],
          [basicProject, okIssue, 'status1'],
        ]);
        const warnedMessages = consoleWarnSpy.mock.calls.map((call) =>
          call.join(' '),
        );
        expect(
          warnedMessages.some((message) => message.includes(staleIssue.url)),
        ).toBe(true);
        expect(
          warnedMessages.some((message) => message.includes(staleIssue.itemId)),
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
          org: 'testOrg',
          repo: 'testRepo',
          storyObjectMap: isolationStoryObjectMap,
          manager,
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
          [basicProject, staleIssue, 'status1'],
          [basicProject, okIssue, 'status1'],
        ]);
      });

      it('resolves normally when no exception occurs (no-op regression check)', async () => {
        await expect(
          useCase.run({
            project: basicProject,
            org: 'testOrg',
            repo: 'testRepo',
            storyObjectMap: isolationStoryObjectMap,
            manager,
          }),
        ).resolves.toBeUndefined();
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual([
          [basicProject, staleIssue, 'status1'],
          [basicProject, okIssue, 'status1'],
        ]);
      });
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

      mockIssueRepository.get.mockResolvedValue(
        managerAssignedIssueWithoutStatus,
      );
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

      mockIssueRepository.get.mockResolvedValue(unassignedIssueWithoutStatus);
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

      mockIssueRepository.get.mockResolvedValue(assignedIceboxIssue);
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

      mockIssueRepository.get.mockResolvedValue(unassignedIceboxIssue);
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

  describe('when the Story or Status changed after the item snapshot was taken', () => {
    const snapshotIssueUrl = 'https://github.com/org/repo/issues/snapshot';
    const storyObjectMapFor = (
      color: StoryOption['color'],
      issue: Issue,
    ): StoryObjectMap =>
      new Map([
        [
          'Story 1',
          {
            ...basicStoryObject1,
            story: { ...basicStoryObject1.story, color },
            issues: [issue],
          },
        ],
      ]);
    const enabledStorySnapshotIssue: Issue = {
      ...basicIssue1,
      url: snapshotIssueUrl,
      story: 'Story 1',
      status: null,
      assignees: [manager],
    };
    const disabledStorySnapshotIssue: Issue = {
      ...enabledStorySnapshotIssue,
      status: 'Awaiting Workspace',
    };

    it.each<{
      label: string;
      storyColor: StoryOption['color'];
      snapshotIssue: Issue;
      liveIssue: Issue | null;
      expectedUpdateStatusCalls: [unknown, unknown, string][];
      expectedCreateCommentCalls: [unknown, string][];
    }>([
      {
        label:
          'does not overwrite a Status an agent set after the snapshot was taken on an item of an enabled story',
        storyColor: 'RED',
        snapshotIssue: enabledStorySnapshotIssue,
        liveIssue: {
          ...enabledStorySnapshotIssue,
          status: 'In Tmux by agent',
        },
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCalls: [],
      },
      {
        label:
          'does not write the first status when the live Story is no longer the enabled story',
        storyColor: 'RED',
        snapshotIssue: enabledStorySnapshotIssue,
        liveIssue: { ...enabledStorySnapshotIssue, story: 'Story 2' },
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCalls: [],
      },
      {
        label: 'does not write when the item is no longer on the project',
        storyColor: 'RED',
        snapshotIssue: enabledStorySnapshotIssue,
        liveIssue: null,
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCalls: [],
      },
      {
        label:
          'writes the first status when the live Status is still empty and the live Story is still the enabled story',
        storyColor: 'RED',
        snapshotIssue: enabledStorySnapshotIssue,
        liveIssue: { ...enabledStorySnapshotIssue },
        expectedUpdateStatusCalls: [
          [basicProject, enabledStorySnapshotIssue, 'status1'],
        ],
        expectedCreateCommentCalls: [
          [
            enabledStorySnapshotIssue,
            'This issue status is changed because the story is enabled.',
          ],
        ],
      },
      {
        label:
          'does not write Icebox when the live Story is no longer the disabled story',
        storyColor: 'GRAY',
        snapshotIssue: disabledStorySnapshotIssue,
        liveIssue: { ...disabledStorySnapshotIssue, story: 'Story 2' },
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCalls: [],
      },
      {
        label: 'does not write Icebox when the live Status is already Icebox',
        storyColor: 'GRAY',
        snapshotIssue: disabledStorySnapshotIssue,
        liveIssue: { ...disabledStorySnapshotIssue, status: 'Icebox' },
        expectedUpdateStatusCalls: [],
        expectedCreateCommentCalls: [],
      },
      {
        label:
          'writes Icebox when the live Story is still the disabled story and the live Status is not Icebox',
        storyColor: 'GRAY',
        snapshotIssue: disabledStorySnapshotIssue,
        liveIssue: { ...disabledStorySnapshotIssue },
        expectedUpdateStatusCalls: [
          [basicProject, disabledStorySnapshotIssue, 'status3'],
        ],
        expectedCreateCommentCalls: [
          [
            disabledStorySnapshotIssue,
            'This issue status is changed because the story is disabled.',
          ],
        ],
      },
    ])(
      '$label',
      async ({
        storyColor,
        snapshotIssue,
        liveIssue,
        expectedUpdateStatusCalls,
        expectedCreateCommentCalls,
      }) => {
        mockIssueRepository.get.mockResolvedValue(liveIssue);

        await useCase.run({
          project: basicProject,
          org: 'testOrg',
          repo: 'testRepo',
          storyObjectMap: storyObjectMapFor(storyColor, snapshotIssue),
          manager,
        });

        expect(mockIssueRepository.get.mock.calls).toEqual([
          [snapshotIssueUrl, basicProject],
        ]);
        expect(mockIssueRepository.updateStatus.mock.calls).toEqual(
          expectedUpdateStatusCalls,
        );
        expect(mockIssueRepository.createComment.mock.calls).toEqual(
          expectedCreateCommentCalls,
        );
      },
    );
  });
});
