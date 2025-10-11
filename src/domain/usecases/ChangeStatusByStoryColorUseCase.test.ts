import { mock } from 'jest-mock-extended';
import { ChangeStatusByStoryColorUseCase } from './ChangeStatusByStoryColorUseCase';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project, StoryOption } from '../entities/Project';
import { StoryObject, StoryObjectMap } from './HandleScheduledEventUseCase';

describe('ChangeStatusByStoryColorUseCase', () => {
  const mockDateRepository = mock<DateRepository>();
  const mockIssueRepository = mock<IssueRepository>();

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
  };
  const basicIssue2 = {
    ...mock<Issue>(),
    title: 'Issue 2',
    number: 101,
    status: 'In Progres',
  };

  const basicStoryObject1: StoryObject = {
    story: {
      ...mock<StoryOption>(),
      id: 'story1',
      name: 'Story 1',
      color: 'RED',
    },
    storyIssue: basicStoryIssue1,
    issues: [
      {
        ...basicIssue1,
        totalWorkingTime: 120,
        totalWorkingTimeByAssignee: new Map<string, number>([
          ['user1', 60],
          ['user2', 60],
        ]),
      },
    ],
  };
  const basicStoryObject2: StoryObject = {
    story: {
      ...mock<StoryOption>(),
      id: 'story2',
      name: 'Story 2',
      color: 'BLUE',
    },
    storyIssue: basicStoryIssue2,
    issues: [
      {
        ...basicIssue2,
        totalWorkingTime: 120,
        totalWorkingTimeByAssignee: new Map<string, number>([
          ['user1', 60],
          ['user2', 60],
        ]),
      },
    ],
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
        disabledStatus: 'Icebox',
        storyObjectMap: basicStoryObjectMap,
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
        disabledStatus: 'Icebox',
        storyObjectMap: basicStoryObjectMap,
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
        disabledStatus: 'Icebox',
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
        disabledStatus: 'Icebox',
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
          disabledStatus: 'Icebox',
          storyObjectMap: basicStoryObjectMap,
        }),
      ).rejects.toThrow('First status is not found');
    });
  });
});
