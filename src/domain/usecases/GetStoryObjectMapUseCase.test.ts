import { mock, MockProxy } from 'jest-mock-extended';
import {
  GetStoryObjectMapUseCase,
  ProjectNotFoundError,
} from './GetStoryObjectMapUseCase';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';

describe('GetStoryObjectMapUseCase', () => {
  let mockProjectRepository: MockProxy<ProjectRepository>;
  let mockIssueRepository: MockProxy<IssueRepository>;
  let useCase: GetStoryObjectMapUseCase;

  const basicProject: Project = {
    id: 'project-1',
    url: 'https://github.com/users/user/projects/1',
    databaseId: 1,
    name: 'Test Project',
    status: {
      name: 'Status',
      fieldId: 'status-field-1',
      statuses: [],
    },
    nextActionDate: null,
    nextActionHour: null,
    story: {
      name: 'Story',
      fieldId: 'story-field-1',
      databaseId: 1,
      stories: [
        { id: 'story-1', name: 'Story 1', color: 'BLUE', description: 'Desc' },
        { id: 'story-2', name: 'Story 2', color: 'GREEN', description: 'Desc' },
      ],
      workflowManagementStory: {
        id: 'wf-story',
        name: 'Workflow',
      },
    },
    remainingEstimationMinutes: null,
    dependedIssueUrlSeparatedByComma: null,
    completionDate50PercentConfidence: null,
  };

  const createBasicIssue = (overrides: Partial<Issue> = {}): Issue => ({
    nameWithOwner: 'org/repo',
    number: 1,
    title: 'Test Issue',
    state: 'OPEN',
    status: null,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: 'https://github.com/org/repo/issues/1',
    assignees: [],
    labels: [],
    org: 'org',
    repo: 'repo',
    body: '',
    itemId: 'item-1',
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockProjectRepository = mock<ProjectRepository>();
    mockIssueRepository = mock<IssueRepository>();
    useCase = new GetStoryObjectMapUseCase(
      mockProjectRepository,
      mockIssueRepository,
    );
  });

  describe('run', () => {
    it('should throw ProjectNotFoundError when project ID is not found', async () => {
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue(null);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/orgs/test/projects/1',
          allowIssueCacheMinutes: 60,
        }),
      ).rejects.toThrow(ProjectNotFoundError);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/orgs/test/projects/1',
          allowIssueCacheMinutes: 60,
        }),
      ).rejects.toThrow(
        'Project not found. projectUrl: https://github.com/orgs/test/projects/1',
      );
    });

    it('should throw ProjectNotFoundError when project is not found by ID', async () => {
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(null);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/orgs/test/projects/1',
          allowIssueCacheMinutes: 60,
        }),
      ).rejects.toThrow(ProjectNotFoundError);

      await expect(
        useCase.run({
          projectUrl: 'https://github.com/orgs/test/projects/1',
          allowIssueCacheMinutes: 60,
        }),
      ).rejects.toThrow(
        'Project not found. projectId: project-1 projectUrl: https://github.com/orgs/test/projects/1',
      );
    });

    it('should return project, issues, cacheUsed and storyObjectMap', async () => {
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(basicProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [],
        cacheUsed: false,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 60,
      });

      expect(result.project).toBe(basicProject);
      expect(result.issues).toEqual([]);
      expect(result.cacheUsed).toBe(false);
      expect(result.storyObjectMap).toBeInstanceOf(Map);
    });

    it('should pass allowIssueCacheMinutes to getAllIssues', async () => {
      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(basicProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [],
        cacheUsed: true,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 120,
      });

      expect(mockIssueRepository.getAllIssues).toHaveBeenCalledWith(
        'project-1',
        120,
      );
      expect(result.cacheUsed).toBe(true);
    });

    it('should create storyObjectMap with issues grouped by story', async () => {
      const issue1 = createBasicIssue({
        number: 1,
        title: 'Issue 1',
        story: 'Story 1',
      });
      const issue2 = createBasicIssue({
        number: 2,
        title: 'Issue 2',
        story: 'Story 1',
      });
      const issue3 = createBasicIssue({
        number: 3,
        title: 'Issue 3',
        story: 'Story 2',
      });

      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(basicProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue1, issue2, issue3],
        cacheUsed: false,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 60,
      });

      const story1Object = result.storyObjectMap.get('Story 1');
      expect(story1Object).toBeDefined();
      expect(story1Object?.issues).toEqual([issue1, issue2]);

      const story2Object = result.storyObjectMap.get('Story 2');
      expect(story2Object).toBeDefined();
      expect(story2Object?.issues).toEqual([issue3]);
    });

    it('should find storyIssue by matching title', async () => {
      const storyIssue = createBasicIssue({
        number: 1,
        title: 'Story 1',
        story: 'Story 1',
      });

      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(basicProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [storyIssue],
        cacheUsed: false,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 60,
      });

      const story1Object = result.storyObjectMap.get('Story 1');
      expect(story1Object?.storyIssue).toEqual(storyIssue);
    });

    it('should set storyIssue to null when no matching issue is found', async () => {
      const issue = createBasicIssue({
        number: 1,
        title: 'Regular Issue',
        story: 'Story 1',
      });

      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(basicProject);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [issue],
        cacheUsed: false,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 60,
      });

      const story1Object = result.storyObjectMap.get('Story 1');
      expect(story1Object?.storyIssue).toBeNull();
    });

    it('should handle project without story configuration', async () => {
      const projectWithoutStory: Project = {
        ...basicProject,
        story: null,
      };

      mockProjectRepository.findProjectIdByUrl.mockResolvedValue('project-1');
      mockProjectRepository.getProject.mockResolvedValue(projectWithoutStory);
      mockIssueRepository.getAllIssues.mockResolvedValue({
        issues: [],
        cacheUsed: false,
      });

      const result = await useCase.run({
        projectUrl: 'https://github.com/orgs/test/projects/1',
        allowIssueCacheMinutes: 60,
      });

      expect(result.storyObjectMap.size).toBe(0);
    });
  });

  describe('createStoryObjectMap', () => {
    it('should return empty map when project has no stories', () => {
      const projectWithoutStory: Project = {
        ...basicProject,
        story: null,
      };

      const result = useCase.createStoryObjectMap({
        project: projectWithoutStory,
        issues: [],
      });

      expect(result.size).toBe(0);
    });

    it('should create map entry for each story with empty issues array', () => {
      const result = useCase.createStoryObjectMap({
        project: basicProject,
        issues: [],
      });

      expect(result.size).toBe(2);
      expect(result.get('Story 1')?.issues).toEqual([]);
      expect(result.get('Story 2')?.issues).toEqual([]);
    });

    it('should include story information in each map entry', () => {
      const result = useCase.createStoryObjectMap({
        project: basicProject,
        issues: [],
      });

      const story1 = result.get('Story 1');
      expect(story1?.story).toEqual({
        id: 'story-1',
        name: 'Story 1',
        color: 'BLUE',
        description: 'Desc',
      });
    });

    it('should not include issues that do not belong to any story', () => {
      const issueWithNoStory = createBasicIssue({
        number: 1,
        title: 'Issue without story',
        story: null,
      });
      const issueWithUnknownStory = createBasicIssue({
        number: 2,
        title: 'Issue with unknown story',
        story: 'Unknown Story',
      });

      const result = useCase.createStoryObjectMap({
        project: basicProject,
        issues: [issueWithNoStory, issueWithUnknownStory],
      });

      expect(result.get('Story 1')?.issues).toEqual([]);
      expect(result.get('Story 2')?.issues).toEqual([]);
    });
  });
});
