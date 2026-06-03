import { mock } from 'jest-mock-extended';
import { AnalyzeProblemByIssueUseCase } from './AnalyzeProblemByIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { Issue } from '../entities/Issue';
import { Project, StoryOption } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';

describe('AnalyzeProblemByIssueUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockDateRepository = mock<DateRepository>();

  const workflowManagementStoryName = 'workflow management';
  const workflowStoryOption: StoryOption = {
    id: 'workflowId',
    name: workflowManagementStoryName,
    color: 'BLUE',
    description: '',
  };
  const basicProject: Project = {
    ...mock<Project>(),
    story: {
      name: 'Story Field',
      fieldId: 'storyFieldId',
      databaseId: 123,
      stories: [workflowStoryOption],
      workflowManagementStory: {
        id: 'workflowId',
        name: workflowManagementStoryName,
      },
    },
  };

  const buildIssue = (overrides: Partial<Issue>): Issue => ({
    ...mock<Issue>(),
    state: 'OPEN',
    isPr: false,
    assignees: [],
    url: 'https://github.com/o/r/issues/0',
    ...overrides,
  });

  let useCase: AnalyzeProblemByIssueUseCase;

  beforeEach(() => {
    jest.resetAllMocks();
    useCase = new AnalyzeProblemByIssueUseCase(
      mockIssueRepository,
      mockDateRepository,
    );
  });

  describe('run', () => {
    it('does nothing when project has no story', async () => {
      const project: Project = { ...basicProject, story: null };
      await useCase.run({
        targetDates: [new Date('2024-01-01T00:00:00Z')],
        project,
        storyObjectMap: new Map(),
        manager: 'manager',
        members: ['alice'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
    it('does nothing when no targetDate hits the top of the hour 0', async () => {
      await useCase.run({
        targetDates: [new Date('2024-01-01T03:30:00Z')],
        project: basicProject,
        storyObjectMap: new Map(),
        manager: 'manager',
        members: ['alice'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createComment).not.toHaveBeenCalled();
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
    it('invokes createWorkflowIssueAlert at the top of hour 0 with the same inputs received by run', async () => {
      const storyObjectMap: StoryObjectMap = new Map([
        [
          workflowManagementStoryName,
          {
            story: workflowStoryOption,
            storyIssue: null,
            issues: [
              buildIssue({
                url: 'https://github.com/o/r/issues/1',
                assignees: ['alice'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/2',
                assignees: ['alice'],
              }),
            ],
          },
        ],
      ]);
      const createWorkflowIssueAlertSpy = jest.spyOn(
        useCase,
        'createWorkflowIssueAlert',
      );
      await useCase.run({
        targetDates: [new Date('2024-01-01T00:00:00Z')],
        project: basicProject,
        storyObjectMap,
        manager: 'manager',
        members: ['alice', 'bob'],
        org: 'org',
        repo: 'repo',
      });
      expect(createWorkflowIssueAlertSpy).toHaveBeenCalledTimes(1);
      expect(createWorkflowIssueAlertSpy).toHaveBeenCalledWith({
        project: basicProject,
        storyObjectMap,
        manager: 'manager',
        members: ['alice', 'bob'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'org',
        'repo',
        'Workflow Issues Count Alert',
        `- @alice 2\n  - https://github.com/o/r/issues/1\n  - https://github.com/o/r/issues/2`,
        ['manager'],
        ['story:workflow-management'],
      );
    });
  });

  describe('createWorkflowIssueAlert', () => {
    it('does not create an issue when workflow story is missing from storyObjectMap', async () => {
      await useCase.createWorkflowIssueAlert({
        project: basicProject,
        storyObjectMap: new Map(),
        manager: 'manager',
        members: ['alice'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
    it('does not create an issue when no member has more than one workflow issue', async () => {
      const storyObjectMap: StoryObjectMap = new Map([
        [
          workflowManagementStoryName,
          {
            story: workflowStoryOption,
            storyIssue: null,
            issues: [
              buildIssue({
                url: 'https://github.com/o/r/issues/1',
                assignees: ['alice'],
              }),
            ],
          },
        ],
      ]);
      await useCase.createWorkflowIssueAlert({
        project: basicProject,
        storyObjectMap,
        manager: 'manager',
        members: ['alice'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
    it('creates an alert issue listing members with more than one open workflow issue', async () => {
      const storyObjectMap: StoryObjectMap = new Map([
        [
          workflowManagementStoryName,
          {
            story: workflowStoryOption,
            storyIssue: null,
            issues: [
              buildIssue({
                url: 'https://github.com/o/r/issues/1',
                assignees: ['alice'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/2',
                assignees: ['alice'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/3',
                assignees: ['bob'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/4',
                assignees: ['bob'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/5',
                assignees: ['bob'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/6',
                assignees: ['carol'],
              }),
            ],
          },
        ],
      ]);
      mockIssueRepository.createNewIssue.mockResolvedValue(99);
      await useCase.createWorkflowIssueAlert({
        project: basicProject,
        storyObjectMap,
        manager: 'manager',
        members: ['alice', 'bob', 'carol'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledTimes(1);
      expect(mockIssueRepository.createNewIssue).toHaveBeenCalledWith(
        'org',
        'repo',
        'Workflow Issues Count Alert',
        `- @bob 3\n  - https://github.com/o/r/issues/3\n  - https://github.com/o/r/issues/4\n  - https://github.com/o/r/issues/5\n- @alice 2\n  - https://github.com/o/r/issues/1\n  - https://github.com/o/r/issues/2`,
        ['manager'],
        ['story:workflow-management'],
      );
    });
    it('ignores closed, merged, non-assigned, and pull request issues', async () => {
      const storyObjectMap: StoryObjectMap = new Map([
        [
          workflowManagementStoryName,
          {
            story: workflowStoryOption,
            storyIssue: null,
            issues: [
              buildIssue({
                url: 'https://github.com/o/r/issues/1',
                assignees: ['alice'],
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/2',
                assignees: ['alice'],
                state: 'CLOSED',
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/3',
                assignees: ['alice'],
                isPr: true,
              }),
              buildIssue({
                url: 'https://github.com/o/r/issues/4',
                assignees: ['bob'],
              }),
            ],
          },
        ],
      ]);
      await useCase.createWorkflowIssueAlert({
        project: basicProject,
        storyObjectMap,
        manager: 'manager',
        members: ['alice', 'bob'],
        org: 'org',
        repo: 'repo',
      });
      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });
});
