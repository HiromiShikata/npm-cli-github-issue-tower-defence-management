import { mock } from 'jest-mock-extended';
import { CreateNewStoryByLabelUseCase } from './CreateNewStoryByLabelUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { FieldOption, Project, StoryOption } from '../entities/Project';
import { StoryObject } from '../entities/StoryObjectMap';

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

  const issueWithNewStoryLabel: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/org/repo/issues/999',
    title: 'New Feature Request',
    number: 999,
    story: 'Existing Story',
    labels: ['bug', 'new-story', 'priority-high'],
  };

  const issueWithNewStoryLabelVariant: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/org/repo/issues/1000',
    title: 'Another New Story',
    number: 1000,
    story: 'Existing Story',
    labels: ['newstory', 'enhancement'],
  };

  const regularIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/org/repo/issues/888',
    title: 'Regular Issue',
    number: 888,
    story: 'Existing Story',
    labels: ['bug', 'priority-low'],
  };

  const unassignedIssueWithNewStoryLabel: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/org/repo/issues/1383',
    title: 'Unassigned Story Issue',
    number: 1383,
    story: null,
    labels: ['new-story'],
  };

  const unassignedRegularIssue: Issue = {
    ...mock<Issue>(),
    url: 'https://github.com/org/repo/issues/1384',
    title: 'Unassigned Regular Issue',
    number: 1384,
    story: null,
    labels: ['bug'],
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
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        issues: [],
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
        storyObjectMap: new Map([
          ['Story 1', storyObjectWithoutNewStoryIssues],
        ]),
        issues: [regularIssue, unassignedRegularIssue],
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
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        issues: [],
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

    it('should create new story for an unassigned issue with new-story label', async () => {
      const savedStories: FieldOption[] = [
        { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
        {
          id: 'newStoryId1',
          name: 'Unassigned Story Issue',
          description: '',
          color: 'RED',
        },
        { id: 'story2', name: 'Middle Story', color: 'GREEN', description: '' },
        { id: 'story3', name: 'Last Story', color: 'YELLOW', description: '' },
      ];

      mockProjectRepository.updateStoryList.mockResolvedValue(savedStories);

      const emptyStoryObjectMap = new Map<string, StoryObject>();

      await useCase.run({
        project: basicProject,
        cacheUsed: false,
        org: 'testOrg',
        repo: 'testRepo',
        storyObjectMap: emptyStoryObjectMap,
        issues: [unassignedIssueWithNewStoryLabel, unassignedRegularIssue],
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
            name: 'Unassigned Story Issue',
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

      expect(mockIssueRepository.updateStory).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateStory).toHaveBeenCalledWith(
        { ...basicProject, story: basicProject.story },
        unassignedIssueWithNewStoryLabel,
        'newStoryId1',
      );

      expect(mockIssueRepository.updateLabels).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateLabels).toHaveBeenCalledWith(
        unassignedIssueWithNewStoryLabel,
        [],
      );
    });

    it('should skip issues when no matching story is found in saved list', async () => {
      const issueWithUnmatchedTitle: Issue = {
        ...mock<Issue>(),
        url: 'https://github.com/org/repo/issues/1001',
        title: 'Unmatched Title',
        number: 1001,
        story: 'Existing Story',
        labels: ['new-story'],
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
        storyObjectMap: new Map([['Story 1', storyObject]]),
        issues: [],
      });

      expect(mockProjectRepository.updateStoryList).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.updateStory).not.toHaveBeenCalled();
      expect(mockIssueRepository.updateLabels).not.toHaveBeenCalled();
    });
  });

  describe('findNewStoryIssues', () => {
    const issueWithNoHyphen: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/org/repo/issues/1002',
      title: 'No Hyphen Issue',
      number: 1002,
      story: 'Some Story',
      labels: ['newstory'],
    };

    const issueWithMixedCase: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/org/repo/issues/1003',
      title: 'Mixed Case Issue',
      number: 1003,
      story: 'Some Story',
      labels: ['NEW-STORY'],
    };

    const anotherIssueWithLabel: Issue = {
      ...mock<Issue>(),
      url: 'https://github.com/org/repo/issues/1004',
      title: 'Another Issue',
      number: 1004,
      story: 'Some Story',
      labels: ['newstory'],
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
      issues: Issue[];
      expectedLength: number;
      expectedIssues: Issue[];
    }> = [
      {
        description:
          'should return empty array when no issues have new-story label',
        storyObjectMap: new Map([['Story 1', storyObjectWithRegularIssue]]),
        issues: [unassignedRegularIssue],
        expectedLength: 0,
        expectedIssues: [],
      },
      {
        description: 'should find issues with "new-story" label (with hyphen)',
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        issues: [],
        expectedLength: 2,
        expectedIssues: [issueWithNewStoryLabel, issueWithNewStoryLabelVariant],
      },
      {
        description: 'should find issues with "newstory" label (no hyphen)',
        storyObjectMap: new Map([['Story 1', storyObjectWithNoHyphen]]),
        issues: [],
        expectedLength: 1,
        expectedIssues: [issueWithNoHyphen],
      },
      {
        description: 'should find issues with mixed case "NEW-STORY" label',
        storyObjectMap: new Map([['Story 1', storyObjectWithMixedCase]]),
        issues: [],
        expectedLength: 1,
        expectedIssues: [issueWithMixedCase],
      },
      {
        description: 'should find issues across multiple story objects',
        storyObjectMap: new Map([
          ['Story 1', storyObjectWithNewStoryIssues],
          ['Story 2', storyObjectWithAnotherIssue],
        ]),
        issues: [],
        expectedLength: 3,
        expectedIssues: [
          issueWithNewStoryLabel,
          issueWithNewStoryLabelVariant,
          anotherIssueWithLabel,
        ],
      },
      {
        description:
          'should find unassigned issues with new-story label not present in storyObjectMap',
        storyObjectMap: new Map<string, StoryObject>(),
        issues: [unassignedIssueWithNewStoryLabel, unassignedRegularIssue],
        expectedLength: 1,
        expectedIssues: [unassignedIssueWithNewStoryLabel],
      },
      {
        description:
          'should not duplicate issue that appears in both storyObjectMap and issues array',
        storyObjectMap: new Map([['Story 1', storyObjectWithNewStoryIssues]]),
        issues: [issueWithNewStoryLabel, unassignedIssueWithNewStoryLabel],
        expectedLength: 3,
        expectedIssues: [
          issueWithNewStoryLabel,
          issueWithNewStoryLabelVariant,
          unassignedIssueWithNewStoryLabel,
        ],
      },
    ];

    test.each(testCases)(
      '$description',
      ({ storyObjectMap, issues, expectedLength, expectedIssues }) => {
        const result = useCase.findNewStoryIssues(storyObjectMap, issues);

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
      issues: Issue[];
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
        issues: [],
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
        issues: [],
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
        issues: [],
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
        issues: [],
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
        issues: [],
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
        issues: [unassignedRegularIssue],
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
      {
        description:
          'should include unassigned issue with new-story label in new story list',
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
          ],
          workflowManagementStory: { id: 'workflow1', name: 'Workflow Story' },
        },
        storyObjectMap: new Map<string, StoryObject>(),
        issues: [unassignedIssueWithNewStoryLabel],
        expected: [
          { id: 'story1', name: 'First Story', color: 'BLUE', description: '' },
          {
            id: null,
            name: 'Unassigned Story Issue',
            color: 'RED',
            description: '',
          },
          {
            id: 'story2',
            name: 'Middle Story',
            color: 'GREEN',
            description: '',
          },
        ],
      },
    ];

    test.each(testCases)(
      '$description',
      ({ projectStory, storyObjectMap, issues, expected }) => {
        const result = useCase.createNewStoryList(
          projectStory,
          storyObjectMap,
          issues,
        );

        expect(result).toEqual(expected);
      },
    );
  });
});
