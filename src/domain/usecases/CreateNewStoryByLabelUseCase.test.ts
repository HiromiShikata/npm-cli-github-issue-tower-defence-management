import { mock } from 'jest-mock-extended';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project, StoryOption } from '../entities/Project';
import { StoryObject } from './HandleScheduledEventUseCase';

describe('CreateNewStoryByLabelUseCase', () => {
  const mockProjectRepository = mock<ProjectRepository>();
  const mockIssueRepository = mock<IssueRepository>();

  const basicProject: Project = {
    ...mock<Project>(),
    id: 'project1',
    story: {
      name: 'Story Field',
      fieldId: 'storyFieldId',
      databaseId: 123,
      stories: [
        { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
        { id: 'story2', name: 'Middle Story', color: 'GREEN', description: '' },
        { id: 'story3', name: 'Last Story', color: 'YELLOW', description: '' },
      ],
      workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
    },
  };

  const issueWithNewStoryLabel = {
    ...mock<Issue>(),
    title: 'New Feature Request',
    number: 999,
    labels: ['bug', 'new-story', 'priority-high'],
    totalWorkingTime: 0,
    totalWorkingTimeByAssignee: new Map<string, number>(),
  };

  const issueWithNewStoryLabelVariant = {
    ...mock<Issue>(),
    title: 'Another New Story',
    number: 1000,
    labels: ['newstory', 'enhancement'],
    totalWorkingTime: 0,
    totalWorkingTimeByAssignee: new Map<string, number>(),
  };

  const regularIssue = {
    ...mock<Issue>(),
    title: 'Regular Issue',
    number: 888,
    labels: ['bug', 'priority-low'],
    totalWorkingTime: 0,
    totalWorkingTimeByAssignee: new Map<string, number>(),
  };

  const storyObjectWithNewStoryIssues: StoryObject = {
    story: {
      ...mock<StoryOption>(),
      id: 'story1',
      name: 'Existing Story',
      color: 'BLUE',
    },
    storyIssue: mock<Issue>(),
    issues: [
      issueWithNewStoryLabel,
      issueWithNewStoryLabelVariant,
      regularIssue,
    ],
  };

  let useCase: CreateNewStoryByLabelUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CreateNewStoryByLabelUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
  });

  describe('run', () => {
    it('should not process anything when project has no story field', async () => {
      const projectWithoutStory: Project = {
        ...basicProject,
        story: null,
      };

      await useCase.run({
        project: projectWithoutStory,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        disabledStatus: 'Icebox',
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
      });

      expect(mockProjectRepository.updateStoryList).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    });

    it('should not process anything when no issues have new-story labels', async () => {
      const storyObjectWithoutNewStoryIssues: StoryObject = {
        story: mock<StoryOption>(),
        storyIssue: mock<Issue>(),
        issues: [regularIssue],
      };

      await useCase.run({
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        disabledStatus: 'Icebox',
        storyObjectMap: new Map([
          ['Story 1', storyObjectWithoutNewStoryIssues],
        ]),
      });

      expect(mockProjectRepository.updateStoryList).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    });

    it('should create new stories for issues with new-story labels', async () => {
      const savedStories: FieldOption[] = [
        { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
        {
          id: 'newStoryId1',
          name: 'New Feature Request',
          description: '',
          color: 'RED',
        },
        {
          id: 'newStoryId2',
          name: 'Another New Story',
          description: '',
          color: 'RED',
        },
        { id: 'story2', name: 'Middle Story', color: 'GREEN', description: '' },
        { id: 'story3', name: 'Last Story', color: 'YELLOW', description: '' },
      ];

      mockProjectRepository.updateStoryList.mockResolvedValue(savedStories);

      await useCase.run({
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        disabledStatus: 'Icebox',
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
      });

      expect(mockProjectRepository.updateStoryList).toHaveBeenCalledTimes(1);
      expect(mockProjectRepository.updateStoryList).toHaveBeenCalledWith(
        basicProject,
        [
          {
            id: 'story1',
            name: 'First Story',
            color: 'BLUE',
            description: '',
          },
          {
            id: null,
            name: 'New Feature Request',
            description: '',
            color: 'RED',
          },
          {
            id: null,
            name: 'Another New Story',
            description: '',
            color: 'RED',
          },
          {
            id: 'story2',
            name: 'Middle Story',
            color: 'GREEN',
            description: '',
          },
          {
            id: 'story3',
            name: 'Last Story',
            color: 'YELLOW',
            description: '',
          },
        ],
      );

      expect(mockIssueRepository.updateStory).toHaveBeenCalledTimes(2);
      expect(mockIssueRepository.updateStory).toHaveBeenNthCalledWith(
        1,
        { ...basicProject, story: basicProject.story },
        issueWithNewStoryLabel,
        'newStoryId1',
      );
      expect(mockIssueRepository.updateStory).toHaveBeenNthCalledWith(
        2,
        { ...basicProject, story: basicProject.story },
        issueWithNewStoryLabelVariant,
        'newStoryId2',
      );

      expect(mockIssueRepository.updateLabels).toHaveBeenCalledTimes(2);
      expect(mockIssueRepository.updateLabels).toHaveBeenNthCalledWith(
        1,
        issueWithNewStoryLabel,
        ['bug', 'priority-high'],
      );
      expect(mockIssueRepository.updateLabels).toHaveBeenNthCalledWith(
        2,
        issueWithNewStoryLabelVariant,
        ['enhancement'],
      );
    });

    it('should skip issues when no matching story is found in saved list', async () => {
      const issueWithUnmatchedTitle = {
        ...mock<Issue>(),
        title: 'Unmatched Title',
        number: 1001,
        labels: ['new-story'],
        totalWorkingTime: 0,
        totalWorkingTimeByAssignee: new Map<string, number>(),
      };

      const storyObject: StoryObject = {
        story: mock<StoryOption>(),
        storyIssue: mock<Issue>(),
        issues: [issueWithUnmatchedTitle],
      };

      mockProjectRepository.updateStoryList.mockResolvedValue([
        { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
        {
          id: 'differentId',
          name: 'Different Name',
          color: 'RED',
          description: '',
        },
      ]);

      await useCase.run({
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        disabledStatus: 'Icebox',
        storyObjectMap: new Map([['Story 1', storyObject]]),
      });

      expect(mockProjectRepository.updateStoryList).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    });
  });

  describe('findNewStoryIssues', () => {
    const issueWithNoHyphen = {
      ...mock<Issue>(),
      title: 'No Hyphen Issue',
      number: 1002,
      labels: ['newstory'],
      totalWorkingTime: 0,
      totalWorkingTimeByAssignee: new Map<string, number>(),
    };

    const issueWithMixedCase = {
      ...mock<Issue>(),
      title: 'Mixed Case Issue',
      number: 1003,
      labels: ['NEW-STORY'],
      totalWorkingTime: 0,
      totalWorkingTimeByAssignee: new Map<string, number>(),
    };

    const anotherIssueWithLabel = {
      ...mock<Issue>(),
      title: 'Another Issue',
      number: 1004,
      labels: ['newstory'],
      totalWorkingTime: 0,
      totalWorkingTimeByAssignee: new Map<string, number>(),
    };

    const storyObjectWithRegularIssue: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [regularIssue],
    };

    const storyObjectWithNoHyphen: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [issueWithNoHyphen],
    };

    const storyObjectWithMixedCase: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [issueWithMixedCase],
    };

    const storyObjectWithAnotherIssue: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [anotherIssueWithLabel],
    };

    const testCases: Array<{
      description: string;
      storyObjectMap: Map<string, StoryObject>;
      expectedLength: number;
      expectedIssues: (Issue & {
        totalWorkingTime: number;
        totalWorkingTimeByAssignee: Map<string, number>;
      })[];
    }> = [
      {
        description:
          'should return empty array when no issues have new-story label',
        storyObjectMap: new Map([['Story 1', storyObjectWithRegularIssue]]),
        expectedLength: 0,
        expectedIssues: [],
      },
      {
        description: 'should find issues with "new-story" label (with hyphen)',
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        expectedLength: 2,
        expectedIssues: [issueWithNewStoryLabel, issueWithNewStoryLabelVariant],
      },
      {
        description: 'should find issues with "newstory" label (no hyphen)',
        storyObjectMap: new Map([['Story 1', storyObjectWithNoHyphen]]),
        expectedLength: 1,
        expectedIssues: [issueWithNoHyphen],
      },
      {
        description: 'should find issues with mixed case "NEW-STORY" label',
        storyObjectMap: new Map([['Story 1', storyObjectWithMixedCase]]),
        expectedLength: 1,
        expectedIssues: [issueWithMixedCase],
      },
      {
        description: 'should find issues across multiple story objects',
        storyObjectMap: new Map([
          ['Story 1', storyObjectWithNewStoryIssues],
          ['Story 2', storyObjectWithAnotherIssue],
        ]),
        expectedLength: 3,
        expectedIssues: [
          issueWithNewStoryLabel,
          issueWithNewStoryLabelVariant,
          anotherIssueWithLabel,
        ],
      },
    ];

    test.each(testCases)(
      '$description',
      ({ storyObjectMap, expectedLength, expectedIssues }) => {
        const result = useCase.findNewStoryIssues(storyObjectMap);

        expect(result).toHaveLength(expectedLength);
        expectedIssues.forEach((issue) => {
          expect(result).toContain(issue);
        });
      },
    );
  });

  describe('createNewStoryList', () => {
    const storyObjectWithSingleNewStory: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [issueWithNewStoryLabel],
    };

    const storyObjectWithRegularIssueOnly: StoryObject = {
      story: mock<StoryOption>(),
      storyIssue: mock<Issue>(),
      issues: [regularIssue],
    };

    const testCases: Array<{
      description: string;
      projectStory: NonNullable<Project['story']>;
      storyObjectMap: Map<string, StoryObject>;
      expected: (Omit<FieldOption, 'id'> & { id: FieldOption['id'] | null })[];
    }> = [
      {
        description:
          'should create new story list with single new story at the beginning',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [
            {
              id: 'story1',
              name: 'First Story',
              color: 'BLUE',
              description: '',
            },
            {
              id: 'story2',
              name: 'Middle Story',
              color: 'GREEN',
              description: '',
            },
            {
              id: 'story3',
              name: 'Last Story',
              color: 'YELLOW',
              description: '',
            },
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithSingleNewStory]]),
        expected: [
          { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
          {
            id: null,
            name: 'New Feature Request',
            color: 'RED',
            description: '',
          },
          {
            id: 'story2',
            name: 'Middle Story',
            color: 'GREEN',
            description: '',
          },
          {
            id: 'story3',
            name: 'Last Story',
            color: 'YELLOW',
            description: '',
          },
        ],
      },
      {
        description: 'should create new story list with multiple new stories',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [
            {
              id: 'story1',
              name: 'First Story',
              color: 'BLUE',
              description: '',
            },
            {
              id: 'story2',
              name: 'Middle Story',
              color: 'GREEN',
              description: '',
            },
            {
              id: 'story3',
              name: 'Last Story',
              color: 'YELLOW',
              description: '',
            },
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        expected: [
          { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
          {
            id: null,
            name: 'New Feature Request',
            color: 'RED',
            description: '',
          },
          {
            id: null,
            name: 'Another New Story',
            color: 'RED',
            description: '',
          },
          {
            id: 'story2',
            name: 'Middle Story',
            color: 'GREEN',
            description: '',
          },
          {
            id: 'story3',
            name: 'Last Story',
            color: 'YELLOW',
            description: '',
          },
        ],
      },
      {
        description: 'should handle empty existing stories list',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithSingleNewStory]]),
        expected: [
          {
            id: null,
            name: 'New Feature Request',
            color: 'RED',
            description: '',
          },
        ],
      },
      {
        description: 'should handle single existing story',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [
            {
              id: 'story1',
              name: 'Only Story',
              color: 'BLUE',
              description: '',
            },
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithSingleNewStory]]),
        expected: [
          { id: 'story1', name: 'Only Story', color: 'BLUE', description: '' },
          {
            id: null,
            name: 'New Feature Request',
            color: 'RED',
            description: '',
          },
        ],
      },
      {
        description: 'should handle two existing stories',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [
            {
              id: 'story1',
              name: 'First Story',
              color: 'BLUE',
              description: '',
            },
            {
              id: 'story2',
              name: 'Second Story',
              color: 'GREEN',
              description: '',
            },
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithSingleNewStory]]),
        expected: [
          { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
          {
            id: null,
            name: 'New Feature Request',
            color: 'RED',
            description: '',
          },
          {
            id: 'story2',
            name: 'Second Story',
            color: 'GREEN',
            description: '',
          },
        ],
      },
      {
        description: 'should handle no new story issues',
        projectStory: {
          name: 'Story Field',
          fieldId: 'storyFieldId',
          databaseId: 123,
          stories: [
            {
              id: 'story1',
              name: 'First Story',
              color: 'BLUE',
              description: '',
            },
            {
              id: 'story2',
              name: 'Middle Story',
              color: 'GREEN',
              description: '',
            },
            {
              id: 'story3',
              name: 'Last Story',
              color: 'YELLOW',
              description: '',
            },
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map([['Story 1', storyObjectWithRegularIssueOnly]]),
        expected: [
          { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
          {
            id: 'story2',
            name: 'Middle Story',
            color: 'GREEN',
            description: '',
          },
          {
            id: 'story3',
            name: 'Last Story',
            color: 'YELLOW',
            description: '',
          },
        ],
      },
    ];

    test.each(testCases)(
      '$description',
      ({ projectStory, storyObjectMap, expected }) => {
        const result = useCase.createNewStoryList(projectStory, storyObjectMap);

        expect(result).toEqual(expected);
      },
    );
  });
});
