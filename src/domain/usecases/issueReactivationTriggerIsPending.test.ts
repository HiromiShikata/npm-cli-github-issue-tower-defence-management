import {
  issueReactivationTriggerIsPending,
  issueReactivationTriggerStartOfTomorrow,
} from './issueReactivationTriggerIsPending';
import { StartPreparationUseCase } from './StartPreparationUseCase';
import { NotifyFinishedIssuePreparationUseCase } from './NotifyFinishedIssuePreparationUseCase';
import { Issue } from '../entities/Issue';
import { Project } from '../entities/Project';
import { StoryObjectMap } from '../entities/StoryObjectMap';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { ProjectRepository } from './adapter-interfaces/ProjectRepository';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { ClaudeTokenUsageRepository } from './adapter-interfaces/ClaudeTokenUsageRepository';
import { TakeOwnershipSpawnRepository } from './adapter-interfaces/TakeOwnershipSpawnRepository';
import { IssueCommentRepository } from './adapter-interfaces/IssueCommentRepository';
import { WebhookRepository } from './adapter-interfaces/WebhookRepository';

const createMinimalIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'user/repo',
  number: 1,
  title: 'Test Issue',
  state: 'OPEN',
  status: 'Awaiting Workspace',
  story: 'Default Story',
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/user/repo/issues/1',
  assignees: ['manager-user'],
  labels: [],
  org: 'user',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: 'testuser',
  closingIssueReferenceUrls: [],
  agent: null,
  ...overrides,
});

const createSpawnMockProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      {
        id: 'awaiting-ws-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const createNotifyMockProject = (): Project => ({
  id: 'notify-project-1',
  url: 'https://github.com/users/user/projects/2',
  databaseId: 2,
  name: 'Notify Project',
  status: {
    name: 'Status',
    fieldId: 'status-field-id',
    statuses: [
      {
        id: 'awaiting-ws-id',
        name: 'Awaiting Workspace',
        color: 'GRAY',
        description: '',
      },
      {
        id: 'preparation-id',
        name: 'Preparation',
        color: 'YELLOW',
        description: '',
      },
      {
        id: 'failed-prep-id',
        name: 'Failed Preparation',
        color: 'RED',
        description: '',
      },
      {
        id: 'awaiting-qc-id',
        name: 'Awaiting Quality Check',
        color: 'BLUE',
        description: '',
      },
    ],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
  agent: null,
});

const createStoryObjectMap = (issues: Issue[]): StoryObjectMap => {
  const map: StoryObjectMap = new Map();
  map.set('Default Story', {
    story: {
      id: 'story-1',
      name: 'Default Story',
      color: 'GRAY',
      description: '',
    },
    storyIssue: null,
    issues,
  });
  return map;
};

describe('issueReactivationTriggerIsPending', () => {
  it.each([
    {
      label: 'returns false when no trigger is set',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: null,
      expected: false,
    },
    {
      label: 'returns true when nextActionDate is tomorrow',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      nextActionHour: null,
      expected: true,
    },
    {
      label: 'returns false when nextActionDate is today',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 15)),
      nextActionHour: null,
      expected: false,
    },
    {
      label: 'returns false when nextActionDate is in the past',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 14)),
      nextActionHour: null,
      expected: false,
    },
    {
      label: 'returns true when nextActionHour is in the future',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 11,
      expected: true,
    },
    {
      label: 'returns false when nextActionHour exactly equals current hour',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 10,
      expected: false,
    },
    {
      label: 'returns false when nextActionHour is in the past',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 9,
      expected: false,
    },
    {
      label: 'returns true when date is future and hour has been reached',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      nextActionHour: 9,
      expected: true,
    },
    {
      label:
        'returns true when nextActionDate is future (production ISO form new Date("YYYY-MM-DD"))',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date('2026-01-16'),
      nextActionHour: null,
      expected: true,
    },
    {
      label:
        'returns false when nextActionDate is today (production ISO form new Date("YYYY-MM-DD"))',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date('2026-01-15'),
      nextActionHour: null,
      expected: false,
    },
  ])('$label', ({ now, nextActionDate, nextActionHour, expected }) => {
    const result = issueReactivationTriggerIsPending(
      { nextActionDate, nextActionHour },
      now,
    );
    expect(result).toBe(expected);
  });
});

describe('issueReactivationTriggerStartOfTomorrow', () => {
  it('returns midnight of the following day', () => {
    const result = issueReactivationTriggerStartOfTomorrow(
      new Date(Date.UTC(2026, 0, 15, 10, 30, 0)),
    );
    expect(result).toEqual(new Date(Date.UTC(2026, 0, 16, 0, 0, 0)));
  });

  it('handles month-end rollover correctly', () => {
    const result = issueReactivationTriggerStartOfTomorrow(
      new Date(Date.UTC(2026, 0, 31, 23, 59, 0)),
    );
    expect(result).toEqual(new Date(Date.UTC(2026, 1, 1, 0, 0, 0)));
  });
});

describe('spawn and finish sides agree on the reactivation trigger predicate', () => {
  const agreementCases: Array<{
    label: string;
    now: Date;
    nextActionDate: Date | null;
    nextActionHour: number | null;
  }> = [
    {
      label: 'no trigger set',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: null,
    },
    {
      label: 'nextActionDate is tomorrow (future)',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      nextActionHour: null,
    },
    {
      label: 'nextActionDate is today (trigger reached)',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 15)),
      nextActionHour: null,
    },
    {
      label: 'nextActionDate is in the past',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 14)),
      nextActionHour: null,
    },
    {
      label: 'nextActionHour is in the future',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 11,
    },
    {
      label: 'nextActionHour exactly equals current hour (boundary)',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 10,
    },
    {
      label: 'nextActionHour is in the past',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: null,
      nextActionHour: 9,
    },
    {
      label: 'date and hour together: future date with reached hour',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      nextActionHour: 9,
    },
    {
      label: 'date and hour together: future date with unreached hour',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date(Date.UTC(2026, 0, 16)),
      nextActionHour: 11,
    },
    {
      label: 'production ISO date form: nextActionDate is future',
      now: new Date(Date.UTC(2026, 0, 15, 10, 0, 0)),
      nextActionDate: new Date('2026-01-16'),
      nextActionHour: null,
    },
  ];

  describe.each(agreementCases)(
    '$label',
    ({ now, nextActionDate, nextActionHour }) => {
      let spawnMockIssueRepository: jest.Mocked<
        Pick<
          IssueRepository,
          | 'getStoryObjectMap'
          | 'getAllOpened'
          | 'updateStatus'
          | 'findRelatedOpenPRs'
          | 'getOpenPullRequest'
          | 'closePullRequest'
          | 'deletePullRequestBranch'
          | 'createCommentByUrl'
          | 'setIssueAgentField'
          | 'removeLabel'
        >
      >;
      let spawnMockProjectRepository: jest.Mocked<
        Pick<ProjectRepository, 'getByUrl' | 'createField' | 'updateAgentList'>
      >;
      let spawnMockLocalCommandRunner: jest.Mocked<LocalCommandRunner>;
      let spawnMockClaudeTokenUsageRepository: jest.Mocked<ClaudeTokenUsageRepository>;
      let spawnMockTakeOwnershipSpawnRepository: jest.Mocked<TakeOwnershipSpawnRepository>;
      let spawnUseCase: StartPreparationUseCase;

      let notifyMockIssueRepository: jest.Mocked<
        Pick<
          IssueRepository,
          | 'get'
          | 'update'
          | 'updateStatus'
          | 'updateLabels'
          | 'getOrCreateLabel'
          | 'findRelatedOpenPRs'
          | 'getStoryObjectMap'
          | 'getOpenPullRequest'
          | 'getPullRequestChangedFilePaths'
          | 'approvePullRequest'
          | 'requestChangesWithInlineComment'
          | 'setDependedIssueUrl'
          | 'setIssueAgentField'
          | 'searchIssue'
          | 'createNewIssue'
          | 'updateNextActionDate'
        >
      >;
      let notifyMockIssueCommentRepository: jest.Mocked<
        Pick<IssueCommentRepository, 'getCommentsFromIssue' | 'createComment'>
      >;
      let notifyMockProjectRepository: jest.Mocked<
        Pick<ProjectRepository, 'getByUrl' | 'updateAgentList' | 'createField'>
      >;
      let notifyMockWebhookRepository: jest.Mocked<
        Pick<WebhookRepository, 'sendGetRequest'>
      >;
      let notifyUseCase: NotifyFinishedIssuePreparationUseCase;

      beforeEach(() => {
        jest.resetAllMocks();
        jest.useFakeTimers().setSystemTime(now);

        const spawnProject = createSpawnMockProject();
        spawnMockProjectRepository = {
          getByUrl: jest.fn().mockResolvedValue(spawnProject),
          createField: jest.fn().mockResolvedValue(undefined),
          updateAgentList: jest.fn().mockResolvedValue([]),
        };
        spawnMockIssueRepository = {
          getStoryObjectMap: jest
            .fn()
            .mockResolvedValue(
              createStoryObjectMap([
                createMinimalIssue({ nextActionDate, nextActionHour }),
              ]),
            ),
          getAllOpened: jest.fn().mockResolvedValue([]),
          updateStatus: jest.fn().mockResolvedValue(undefined),
          findRelatedOpenPRs: jest.fn().mockResolvedValue([]),
          getOpenPullRequest: jest.fn().mockResolvedValue(null),
          closePullRequest: jest.fn().mockResolvedValue(undefined),
          deletePullRequestBranch: jest.fn().mockResolvedValue(undefined),
          createCommentByUrl: jest.fn().mockResolvedValue(undefined),
          setIssueAgentField: jest.fn().mockResolvedValue(undefined),
          removeLabel: jest.fn().mockResolvedValue(undefined),
        };
        spawnMockLocalCommandRunner = {
          runCommand: jest
            .fn()
            .mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }),
        };
        spawnMockClaudeTokenUsageRepository = {
          ensureObservable: jest.fn().mockResolvedValue(undefined),
          getAvailableTokenUsages: jest.fn().mockResolvedValue([]),
          getTokenInFlightCounts: jest.fn().mockResolvedValue({}),
          proxyBaseUrl: jest.fn().mockReturnValue('http://127.0.0.1:8787'),
        };
        spawnMockTakeOwnershipSpawnRepository = {
          listSpawns: jest.fn().mockReturnValue([]),
          listRunningIssueUrls: jest.fn().mockReturnValue([]),
        };
        spawnUseCase = new StartPreparationUseCase(
          spawnMockProjectRepository,
          spawnMockIssueRepository,
          spawnMockLocalCommandRunner,
          spawnMockClaudeTokenUsageRepository,
          spawnMockTakeOwnershipSpawnRepository,
        );

        const notifyProject = createNotifyMockProject();
        notifyMockProjectRepository = {
          getByUrl: jest.fn().mockResolvedValue(notifyProject),
          updateAgentList: jest.fn().mockResolvedValue([]),
          createField: jest.fn().mockResolvedValue(undefined),
        };
        notifyMockIssueRepository = {
          get: jest.fn().mockResolvedValue(
            createMinimalIssue({
              status: 'Preparation',
              nextActionDate,
              nextActionHour,
            }),
          ),
          update: jest.fn().mockResolvedValue(undefined),
          updateStatus: jest.fn().mockResolvedValue(undefined),
          updateLabels: jest.fn().mockResolvedValue(undefined),
          getOrCreateLabel: jest.fn().mockResolvedValue(undefined),
          findRelatedOpenPRs: jest.fn().mockResolvedValue([
            {
              url: 'https://github.com/user/repo/pull/1',
              isConflicted: false,
              isPassedAllCiJob: true,
              isCiStateSuccess: true,
              isResolvedAllReviewComments: true,
              isBranchOutOfDate: false,
              missingRequiredCheckNames: [],
              isDraft: false,
              mergeable: 'MERGEABLE',
              branchName: 'i1',
              createdAt: new Date(),
            },
          ]),
          getStoryObjectMap: jest.fn().mockResolvedValue(new Map()),
          getOpenPullRequest: jest.fn().mockResolvedValue(null),
          getPullRequestChangedFilePaths: jest.fn().mockResolvedValue([]),
          approvePullRequest: jest.fn().mockResolvedValue(undefined),
          requestChangesWithInlineComment: jest
            .fn()
            .mockResolvedValue(undefined),
          setDependedIssueUrl: jest.fn().mockResolvedValue(undefined),
          setIssueAgentField: jest.fn().mockResolvedValue(undefined),
          searchIssue: jest.fn().mockResolvedValue([]),
          createNewIssue: jest.fn().mockResolvedValue(42),
          updateNextActionDate: jest.fn().mockResolvedValue(undefined),
        };
        notifyMockIssueCommentRepository = {
          getCommentsFromIssue: jest.fn().mockResolvedValue([
            {
              author: 'bot',
              content: 'From: :robot: developer (claude-opus-5)',
              createdAt: new Date(),
            },
          ]),
          createComment: jest.fn().mockResolvedValue(undefined),
        };
        notifyMockWebhookRepository = {
          sendGetRequest: jest.fn().mockResolvedValue(undefined),
        };
        notifyUseCase = new NotifyFinishedIssuePreparationUseCase(
          notifyMockProjectRepository,
          notifyMockIssueRepository,
          notifyMockIssueCommentRepository,
          notifyMockWebhookRepository,
        );
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('spawn side starts the issue if and only if finish side does not send it back for the trigger', async () => {
        const triggerIsPending = issueReactivationTriggerIsPending(
          { nextActionDate, nextActionHour },
          now,
        );

        await spawnUseCase.run({
          projectUrl: 'https://github.com/users/user/projects/1',
          defaultAgentName: 'agent1',
          defaultLlmModelName: 'claude-sonnet-4-6',
          fallbackLlmModelName: null,
          defaultLlmAgentName: null,
          configFilePath: '/path/to/config.yml',
          maximumPreparingIssuesCount: null,
          utilizationPercentageThreshold: 90,
          allowedIssueAuthors: ['testuser'],
          manager: 'manager-user',
          codexHomeCandidates: null,
          labelsAsLlmAgentName: null,
        });

        const spawnStarted =
          spawnMockIssueRepository.updateStatus.mock.calls.some(
            (call) => call[2] === 'preparation-id',
          );

        await notifyUseCase.run({
          projectUrl: 'https://github.com/users/user/projects/2',
          issueUrl: 'https://github.com/user/repo/issues/1',
          thresholdForAutoReject: 3,
          workflowBlockerResolvedWebhookUrl: null,
          allowedIssueAuthors: null,
        });

        const TRIGGER_MESSAGE = 'Reactivation trigger not yet reached';
        const triggerSentBack =
          notifyMockIssueCommentRepository.createComment.mock.calls.some(
            (call) =>
              typeof call[1] === 'string' && call[1].includes(TRIGGER_MESSAGE),
          );

        expect(spawnStarted).toBe(!triggerIsPending);
        expect(triggerSentBack).toBe(triggerIsPending);
      });
    },
  );
});
