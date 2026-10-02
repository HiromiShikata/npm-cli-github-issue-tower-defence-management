import { mock } from 'jest-mock-extended';
import { CreateEstimationIssueUseCase } from './CreateEstimationIssueUseCase';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { DateRepository } from './adapter-interfaces/DateRepository';
import { Project } from '../entities/Project';
import { StoryObject } from '../entities/StoryObjectMap';
import { Issue } from '../entities/Issue';
import { StaleProjectItemError } from './SetupTowerDefenceProjectUseCase';

describe('CreateEstimationIssueUseCase', () => {
  const mockIssueRepository = mock<IssueRepository>();
  const mockDateRepository = mock<DateRepository>();

  let useCase: CreateEstimationIssueUseCase;

  const projectWithStory: Project = {
    ...mock<Project>(),
    story: {
      name: 'Story',
      fieldId: 'story-field',
      databaseId: 1,
      stories: [],
      workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
    },
    remainingEstimationMinutes: null,
    completionDate50PercentConfidence: null,
  };

  const commonInput = {
    project: projectWithStory,
    issues: [],
    cacheUsed: false,
    manager: 'manager-user',
    org: 'org',
    repo: 'repo',
    urlOfStoryView: 'https://github.com/org/repo',
    storyObjectMap: new Map<string, StoryObject>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueRepository.getIssueOrPullRequestComments.mockResolvedValue([]);
    useCase = new CreateEstimationIssueUseCase(
      mockIssueRepository,
      mockDateRepository,
    );
  });

  describe('run — UTC 07:00 guard', () => {
    it('returns early when no targetDate is at UTC 07:00', async () => {
      const nonMatchingDate = new Date(Date.UTC(2026, 0, 15, 6, 0, 0));

      await useCase.run({ ...commonInput, targetDates: [nonMatchingDate] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when targetDates is empty', async () => {
      await useCase.run({ ...commonInput, targetDates: [] });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when project has no story field', async () => {
      const projectWithoutStory: Project = { ...projectWithStory, story: null };

      await useCase.run({
        ...commonInput,
        project: projectWithoutStory,
        targetDates: [new Date(Date.UTC(2026, 0, 15, 7, 0, 0))],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });
  });

  describe('run — weekend skip', () => {
    const projectWithNonRegularStory: Project = {
      ...projectWithStory,
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 1,
        stories: [
          {
            id: 'story-1',
            name: 'Feature Story',
            color: 'BLUE',
            description: '',
          },
        ],
        workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
      },
    };

    it('returns early when the last targetDate falls on Saturday UTC', async () => {
      const saturdayAt07h = new Date(Date.UTC(2026, 0, 17, 7, 0, 0));
      expect(saturdayAt07h.getUTCDay()).toBe(6);

      await useCase.run({
        ...commonInput,
        project: projectWithNonRegularStory,
        targetDates: [saturdayAt07h],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('returns early when the last targetDate falls on Sunday UTC', async () => {
      const sundayAt07h = new Date(Date.UTC(2026, 0, 18, 7, 0, 0));
      expect(sundayAt07h.getUTCDay()).toBe(0);

      await useCase.run({
        ...commonInput,
        project: projectWithNonRegularStory,
        targetDates: [sundayAt07h],
      });

      expect(mockIssueRepository.createNewIssue).not.toHaveBeenCalled();
    });

    it('proceeds past the weekend guard on a weekday UTC 07:00', async () => {
      const thursdayAt07h = new Date(Date.UTC(2026, 0, 15, 7, 0, 0));
      expect(thursdayAt07h.getUTCDay()).toBe(4);

      await expect(
        useCase.run({
          ...commonInput,
          project: projectWithNonRegularStory,
          targetDates: [thursdayAt07h],
        }),
      ).rejects.toThrow('Story issue not found: Feature Story');
    });
  });

  describe('run — completionDate50PercentConfidence Monday UTC reset', () => {
    const mondayAt07hUTC = new Date(Date.UTC(2026, 0, 12, 7, 0, 0));

    const featureStory = {
      id: 'story-feat',
      name: 'Feature Story',
      color: 'BLUE' as const,
      description: '',
    };

    const projectWithCompletionField: Project = {
      ...mock<Project>(),
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 1,
        stories: [featureStory],
        workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
      },
      remainingEstimationMinutes: null,
      completionDate50PercentConfidence: {
        name: 'Completion Date',
        fieldId: 'completion-field',
      },
    };

    const storyIssue: Issue = {
      ...mock<Issue>(),
      title: 'Feature Story',
      labels: ['story', 'story:action:schedule-control'],
      isClosed: false,
      isPr: false,
      url: 'https://github.com/org/repo/issues/1',
    };

    const farFutureDate = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));
    const issueInStory: Issue = {
      ...mock<Issue>(),
      title: 'Task issue',
      labels: [],
      isClosed: false,
      isPr: false,
      status: null,
      estimationMinutes: null,
      completionDate50PercentConfidence: farFutureDate,
      assignees: ['dev-user'],
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('clears completionDate50PercentConfidence on UTC Monday even when date is far in future', async () => {
      expect(mondayAt07hUTC.getUTCDay()).toBe(1);

      mockDateRepository.formatDateWithDayOfWeek.mockReturnValue(
        'Mon, Jun 01, 2026',
      );

      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          { story: featureStory, storyIssue, issues: [issueInStory] },
        ],
      ]);

      const runPromise = useCase.run({
        project: projectWithCompletionField,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.clearProjectField).toHaveBeenCalledWith(
        projectWithCompletionField,
        'completion-field',
        issueInStory,
      );
      const body = mockIssueRepository.createNewIssue.mock.calls[0]?.[3];
      expect(body).not.toContain('From: :robot:');
      expect(body).toContain('This issue is experimental workflow :pray:');
    });

    it('should retry once and succeed when createComment first fails with a transient 502 error, backing off via the injected sleep before retrying', async () => {
      mockDateRepository.formatDateWithDayOfWeek.mockReturnValue(
        'Mon, Jun 01, 2026',
      );
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new CreateEstimationIssueUseCase(
        mockIssueRepository,
        mockDateRepository,
        mockSleep,
      );
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createComment
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(undefined);

      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          { story: featureStory, storyIssue, issues: [issueInStory] },
        ],
      ]);

      const runPromise = retryingUseCase.run({
        project: projectWithCompletionField,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.createComment).toHaveBeenCalledTimes(2);
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });

    it('should not re-post when createComment first fails with a transient 502 error and a duplicate comment is found on re-check', async () => {
      mockDateRepository.formatDateWithDayOfWeek.mockReturnValue(
        'Mon, Jun 01, 2026',
      );
      const mockSleep = jest
        .fn<Promise<void>, [number]>()
        .mockResolvedValue(undefined);
      const retryingUseCase = new CreateEstimationIssueUseCase(
        mockIssueRepository,
        mockDateRepository,
        mockSleep,
      );
      const transientError = Object.assign(
        new Error(
          'Failed to create comment via GitHub REST API: 502 Bad Gateway',
        ),
        { name: 'GitHubCommentCreateHttpError', statusCode: 502 },
      );
      mockIssueRepository.createComment.mockRejectedValueOnce(transientError);
      mockIssueRepository.getIssueOrPullRequestComments
        .mockResolvedValueOnce([])
        .mockImplementationOnce(async () => [
          {
            author: 'bot',
            body: mockIssueRepository.createComment.mock.calls[0]?.[1] ?? '',
            createdAt: new Date(),
          },
        ]);

      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          { story: featureStory, storyIssue, issues: [issueInStory] },
        ],
      ]);

      const runPromise = retryingUseCase.run({
        project: projectWithCompletionField,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.createComment).toHaveBeenCalledTimes(1);
      expect(mockSleep).toHaveBeenCalledTimes(1);
    });
  });

  describe('stale project item isolation and failure aggregation (issue #2789)', () => {
    const mondayAt07hUTC = new Date(Date.UTC(2026, 0, 12, 7, 0, 0));
    const farFutureDate = new Date(Date.UTC(2026, 5, 1, 0, 0, 0));

    const featureStory = {
      id: 'story-feat-iso',
      name: 'Feature Story ISO',
      color: 'BLUE' as const,
      description: '',
    };

    const projectBase: Project = {
      ...mock<Project>(),
      story: {
        name: 'Story',
        fieldId: 'story-field',
        databaseId: 1,
        stories: [featureStory],
        workflowManagementStory: { id: 'wms-id', name: 'workflow management' },
      },
      remainingEstimationMinutes: {
        name: 'Remaining Estimation (minutes)',
        fieldId: 'estimation-field',
      },
      completionDate50PercentConfidence: {
        name: 'Completion Date',
        fieldId: 'completion-field',
      },
    };

    const storyIssue: Issue = {
      ...mock<Issue>(),
      title: 'Feature Story ISO',
      labels: ['story', 'story:action:schedule-control'],
      isClosed: false,
      isPr: false,
      url: 'https://github.com/org/repo/issues/1',
    };

    const buildEstimationOnlyIssue = (url: string, itemId: string): Issue => ({
      ...mock<Issue>(),
      url,
      itemId,
      title: 'Task',
      labels: [],
      isClosed: false,
      isPr: false,
      status: null,
      estimationMinutes: 30,
      completionDate50PercentConfidence: null,
      assignees: [],
    });

    const buildMultiWriteIssue = (url: string, itemId: string): Issue => ({
      ...mock<Issue>(),
      url,
      itemId,
      title: 'Task Multi',
      labels: [],
      isClosed: false,
      isPr: false,
      status: null,
      estimationMinutes: 30,
      completionDate50PercentConfidence: farFutureDate,
      assignees: [],
    });

    beforeEach(() => {
      jest.useFakeTimers();
      mockDateRepository.formatDateWithDayOfWeek.mockReturnValue(
        'Mon, Jun 01, 2026',
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('skips an issue whose clearProjectField call fails with StaleProjectItemError, logging it via console.warn with the issue url and stale item id, while the other issue in the same run is still processed', async () => {
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const staleIssue = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/901',
        'item-stale-1',
      );
      const okIssue = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/902',
        'item-ok-1',
      );
      mockIssueRepository.clearProjectField.mockImplementation(
        async (_project, _fieldId, issue) => {
          if (issue.url === staleIssue.url) {
            throw new StaleProjectItemError(staleIssue.itemId);
          }
        },
      );
      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          { story: featureStory, storyIssue, issues: [staleIssue, okIssue] },
        ],
      ]);

      const runPromise = useCase.run({
        project: projectBase,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
        [projectBase, 'estimation-field', staleIssue],
        [projectBase, 'estimation-field', okIssue],
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
      const failingIssue = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/903',
        'item-fail-1',
      );
      const okIssue = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/904',
        'item-ok-2',
      );
      const underlyingError = new Error('GitHub API rate limit exceeded');
      mockIssueRepository.clearProjectField.mockImplementation(
        async (_project, _fieldId, issue) => {
          if (issue.url === failingIssue.url) {
            throw underlyingError;
          }
        },
      );
      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          {
            story: featureStory,
            storyIssue,
            issues: [failingIssue, okIssue],
          },
        ],
      ]);

      const runPromise = useCase.run({
        project: projectBase,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      runPromise.catch(() => {});
      await jest.runAllTimersAsync();
      let caughtError: unknown;
      try {
        await runPromise;
      } catch (error) {
        caughtError = error;
      }

      if (!(caughtError instanceof Error)) {
        throw new Error('Expected run() to reject with an Error instance');
      }
      expect(caughtError.message).toContain(failingIssue.url);
      expect(caughtError.message).toContain(underlyingError.message);
      expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
        [projectBase, 'estimation-field', failingIssue],
        [projectBase, 'estimation-field', okIssue],
      ]);
    });

    it('resolves normally when no exception occurs (no-op regression check)', async () => {
      const issueA = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/905',
        'item-a-1',
      );
      const issueB = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/906',
        'item-b-1',
      );
      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          { story: featureStory, storyIssue, issues: [issueA, issueB] },
        ],
      ]);

      const runPromise = useCase.run({
        project: projectBase,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await expect(runPromise).resolves.toBeUndefined();

      expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
        [projectBase, 'estimation-field', issueA],
        [projectBase, 'estimation-field', issueB],
      ]);
    });

    it('skips the second write (completionDate clear) for an issue whose first write (estimation clear) fails with StaleProjectItemError, and still processes the next issue', async () => {
      const multiWriteStaleIssue = buildMultiWriteIssue(
        'https://github.com/org/repo/issues/907',
        'item-stale-2',
      );
      const okIssue = buildEstimationOnlyIssue(
        'https://github.com/org/repo/issues/908',
        'item-ok-3',
      );
      mockIssueRepository.clearProjectField.mockImplementation(
        async (_project, fieldId, issue) => {
          if (
            issue.url === multiWriteStaleIssue.url &&
            fieldId === 'estimation-field'
          ) {
            throw new StaleProjectItemError(multiWriteStaleIssue.itemId);
          }
        },
      );
      const storyObjectMap = new Map<string, StoryObject>([
        [
          featureStory.id,
          {
            story: featureStory,
            storyIssue,
            issues: [multiWriteStaleIssue, okIssue],
          },
        ],
      ]);

      const runPromise = useCase.run({
        project: projectBase,
        issues: [storyIssue],
        cacheUsed: false,
        manager: 'manager-user',
        org: 'org',
        repo: 'repo',
        urlOfStoryView: 'https://github.com/org/repo',
        storyObjectMap,
        targetDates: [mondayAt07hUTC],
      });
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockIssueRepository.clearProjectField.mock.calls).toEqual([
        [projectBase, 'estimation-field', multiWriteStaleIssue],
        [projectBase, 'estimation-field', okIssue],
      ]);
      expect(
        mockIssueRepository.clearProjectField.mock.calls.some(
          ([, fieldId, issue]) =>
            issue.url === multiWriteStaleIssue.url &&
            fieldId === 'completion-field',
        ),
      ).toBe(false);
    });
  });
});
