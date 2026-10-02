import {
  BoardCache,
  BoardCacheIssue,
  StoryGateBoardCacheRepository,
} from '../adapter-interfaces/StoryGateBoardCacheRepository';
import {
  ClosingPullRequest,
  GithubIssueReference,
  IssueProjectItem,
  IssueProjectItemsSnapshot,
  ProjectItemSingleSelectValueUpdate,
  ProjectSingleSelectOption,
  StoryGateGithubRequestError,
  StoryGateIssue,
  StoryGateIssueComment,
  StoryGateIssueRepository,
  StoryGateIssueState,
} from '../adapter-interfaces/StoryGateIssueRepository';
import {
  StoryGateProjectConfig,
  StoryGateProjectConfigRepository,
} from '../adapter-interfaces/StoryGateProjectConfigRepository';
import {
  StoryGateCheckInput,
  StoryGateCheckOutput,
  StoryGateCheckUseCase,
} from './StoryGateCheckUseCase';

const ORG = 'example-org';
const OTHER_ORG = 'other-org';
const REPO = 'repo';
const ASSIGNED = 1;
const BOARD_PROJECT_ID = 'PVT_board';
const OTHER_PROJECT_ID = 'PVT_other';
const STORY_FIELD_ID = 'FIELD_story';
const OUTPUT_DIRECTORY = '/story-gate-output';
const AGENT_PREFIX_LINE = 'From: :robot: developer-agent (model)';

const issueUrl = (number: number): string =>
  `https://github.com/${ORG}/${REPO}/issues/${number}`;

const otherOrgIssueUrl = (number: number): string =>
  `https://github.com/${OTHER_ORG}/${REPO}/issues/${number}`;

const pullRequestUrl = (number: number): string =>
  `https://github.com/${ORG}/${REPO}/pull/${number}`;

const issueReference = (number: number): GithubIssueReference => ({
  owner: ORG,
  repo: REPO,
  number,
  url: issueUrl(number),
});

const STORY_OPTIONS: ProjectSingleSelectOption[] = [
  { id: 'OPT_regular', name: 'regular / chores', color: 'BLUE' },
  { id: 'OPT_feature_a', name: 'feature A', color: 'GREEN' },
  { id: 'OPT_feature_b', name: 'feature B', color: 'RED' },
  { id: 'OPT_retired', name: 'retired story', color: 'GRAY' },
  { id: 'OPT_no_story', name: 'NO STORY', color: 'YELLOW' },
  { id: 'OPT_backlog', name: 'milestone on Backlog 2026', color: 'ORANGE' },
];

const ACTIVE_STORY_OPTION_NAMES = [
  'regular / chores',
  'feature A',
  'feature B',
  'NO STORY',
  'milestone on Backlog 2026',
];

const STORY_ISSUE_NUMBER_BY_STORY: Record<string, number> = {
  'feature A': 100,
  'feature B': 101,
  'regular / chores': 102,
  'milestone on Backlog 2026': 103,
};

const STORY_ISSUE_URL_BY_OPTION_NAME: Record<string, string> =
  Object.fromEntries(
    Object.entries(STORY_ISSUE_NUMBER_BY_STORY).map(([name, number]) => [
      name,
      issueUrl(number),
    ]),
  );

const ROUTING_JSON = {
  nextStepAgent: 'triage-agent',
  returnToAgent: 'developer-agent',
};

const DEFAULT_INPUT: StoryGateCheckInput = {
  issue: issueReference(ASSIGNED),
  agentName: 'developer-agent',
  triageAgentName: 'triage-agent',
  specificationAgentName: 'spec-agent',
  outputDirectory: OUTPUT_DIRECTORY,
  dryRun: false,
};

const DEFAULT_CONFIG: StoryGateProjectConfig = {
  filePath: 'config/example.config.yaml',
  org: ORG,
  agents: ['developer-agent', 'triage-agent', 'spec-agent'],
};

const liveItem = (
  projectId: string,
  storyName: string | null,
  itemId: string,
): IssueProjectItem => ({
  projectId,
  itemId,
  storyField: { fieldId: STORY_FIELD_ID, options: STORY_OPTIONS },
  storyName,
  agentField: null,
  agentName: null,
  statusField: null,
  statusName: null,
});

const cacheIssue = (
  number: number,
  story: string | null,
  overrides: Partial<BoardCacheIssue> = {},
): BoardCacheIssue => ({
  url: issueUrl(number),
  story,
  labels: [],
  body: '',
  itemId: `ITEM_${number}`,
  ...overrides,
});

const boardCache = (overrides: Partial<BoardCache> = {}): BoardCache => ({
  filePath: 'cache/example/allIssues-PVT_board/latest.json',
  modifiedAt: new Date('2026-09-01T00:00:00Z'),
  projectId: BOARD_PROJECT_ID,
  storyFieldId: STORY_FIELD_ID,
  storyOptions: STORY_OPTIONS,
  storyIssueUrlByOptionName: STORY_ISSUE_URL_BY_OPTION_NAME,
  issues: [],
  ...overrides,
});

const numbered = (prefix: string, count: number): string[] =>
  Array.from(
    { length: count },
    (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`,
  );

const agentComment = (text: string): string => `${AGENT_PREFIX_LINE}\n${text}`;

const FOLD_COMMENT = agentComment('## Fold\nfold-summary');

const agentBodyLinking = (...numbers: number[]): string =>
  [
    AGENT_PREFIX_LINE,
    '',
    'Related tasks:',
    ...numbers.map((number) => `- ${issueUrl(number)}`),
  ].join('\n');

const specificationRoutingComment = (nextStepAgent: string): string =>
  [
    AGENT_PREFIX_LINE,
    '',
    '承認済み仕様: なし',
    '',
    '```json',
    JSON.stringify({ nextStepAgent, returnToAgent: 'developer-agent' }),
    '```',
  ].join('\n');

type IssueFixture = {
  number: number;
  state?: StoryGateIssueState;
  body?: string;
  labels?: string[];
  comments?: string[];
  items?: IssueProjectItem[];
  closingPullRequests?: ClosingPullRequest[];
};

class InMemoryStoryGateIssueRepository implements StoryGateIssueRepository {
  readonly issues = new Map<string, StoryGateIssue>();
  readonly comments = new Map<string, StoryGateIssueComment[]>();
  readonly projectItems = new Map<string, IssueProjectItemsSnapshot>();
  readonly queuedProjectItems = new Map<string, IssueProjectItemsSnapshot[]>();
  readonly closingPullRequests = new Map<string, ClosingPullRequest[]>();
  readonly issueReads: string[] = [];
  readonly projectItemReads: string[] = [];
  readonly updates: ProjectItemSingleSelectValueUpdate[] = [];
  readonly issueReadFailureStatusByUrl = new Map<string, number | null>();
  appliesUpdates = true;

  issueUnreadableUrlAdd = (url: string, status: number | null = 403): void => {
    this.issueReadFailureStatusByUrl.set(url, status);
  };

  issueAdd = (fixture: IssueFixture): void => {
    this.issueAddAtUrl(issueUrl(fixture.number), fixture);
  };

  issueAddAtUrl = (
    url: string,
    fixture: Omit<IssueFixture, 'number'> = {},
  ): void => {
    const state = fixture.state ?? 'OPEN';
    this.issues.set(url, {
      url,
      state,
      body: fixture.body ?? '',
      labels: fixture.labels ?? [],
    });
    this.comments.set(
      url,
      (fixture.comments ?? []).map((body, index) => ({
        url: `${url}#issuecomment-${index + 1}`,
        createdAt: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
        body,
      })),
    );
    this.projectItems.set(url, { state, items: fixture.items ?? [] });
    this.closingPullRequests.set(url, fixture.closingPullRequests ?? []);
  };

  findIssue = async (
    issue: GithubIssueReference,
  ): Promise<StoryGateIssue | null> => {
    this.issueReads.push(issue.url);
    if (this.issueReadFailureStatusByUrl.has(issue.url)) {
      const status = this.issueReadFailureStatusByUrl.get(issue.url) ?? null;
      throw new StoryGateGithubRequestError(
        `GET ${issue.url} returned HTTP ${status ?? 'unknown'}`,
        status,
      );
    }
    return this.issues.get(issue.url) ?? null;
  };

  listIssueComments = async (
    issue: GithubIssueReference,
  ): Promise<StoryGateIssueComment[]> => this.comments.get(issue.url) ?? [];

  findIssueProjectItems = async (
    issue: GithubIssueReference,
  ): Promise<IssueProjectItemsSnapshot | null> => {
    this.projectItemReads.push(issue.url);
    const queued = this.queuedProjectItems.get(issue.url) ?? [];
    const next = queued.shift();
    if (next !== undefined) {
      return next;
    }
    return this.projectItems.get(issue.url) ?? null;
  };

  listClosingPullRequests = async (
    issue: GithubIssueReference,
  ): Promise<ClosingPullRequest[]> =>
    this.closingPullRequests.get(issue.url) ?? [];

  updateProjectItemSingleSelectValue = async (
    update: ProjectItemSingleSelectValueUpdate,
  ): Promise<void> => {
    this.updates.push(update);
    if (!this.appliesUpdates) {
      return;
    }
    for (const [url, snapshot] of this.projectItems) {
      this.projectItems.set(url, {
        ...snapshot,
        items: snapshot.items.map((item) =>
          item.projectId === update.projectId &&
          item.itemId === update.itemId &&
          item.storyField?.fieldId === update.fieldId
            ? {
                ...item,
                storyName:
                  item.storyField.options.find(
                    (option) => option.id === update.optionId,
                  )?.name ?? null,
              }
            : item,
        ),
      });
    }
  };
}

type AssignedIssueOptions = {
  story?: string | null;
  inCache?: boolean;
  liveItems?: IssueProjectItem[];
  state?: StoryGateIssueState;
  body?: string;
  labels?: string[];
  comments?: string[];
  closingPullRequests?: ClosingPullRequest[];
  cacheIssues?: BoardCacheIssue[];
  storyIssueUrlByOptionName?: Record<string, string>;
};

type LinkedTaskOptions = {
  inCache?: boolean;
  liveItems?: IssueProjectItem[];
};

class StoryGateScenario {
  readonly repository = new InMemoryStoryGateIssueRepository();
  readonly board: BoardCache;
  caches: BoardCache[];
  configs: StoryGateProjectConfig[] = [DEFAULT_CONFIG];

  constructor(options: AssignedIssueOptions = {}) {
    const story = options.story === undefined ? 'feature A' : options.story;
    const body = options.body ?? 'Implement the list screen';
    const labels = options.labels ?? [];
    this.board = boardCache({
      issues: [
        ...(options.inCache === false
          ? []
          : [cacheIssue(ASSIGNED, story, { body, labels })]),
        ...(options.cacheIssues ?? []),
      ],
      storyIssueUrlByOptionName:
        options.storyIssueUrlByOptionName ?? STORY_ISSUE_URL_BY_OPTION_NAME,
    });
    this.caches = [this.board];
    this.repository.issueAdd({
      number: ASSIGNED,
      state: options.state,
      body,
      labels,
      comments: options.comments,
      items: options.liveItems ?? [
        liveItem(BOARD_PROJECT_ID, story, `ITEM_${ASSIGNED}`),
      ],
      closingPullRequests: options.closingPullRequests,
    });
    Object.entries(STORY_ISSUE_NUMBER_BY_STORY).forEach(([name, number]) =>
      this.repository.issueAdd({
        number,
        body: `Story issue for ${name}`,
        labels: ['story'],
      }),
    );
  }

  linkedTaskAdd = (
    number: number,
    story: string | null,
    options: LinkedTaskOptions = {},
  ): void => {
    if (options.inCache !== false) {
      this.board.issues.push(cacheIssue(number, story));
    }
    this.repository.issueAdd({
      number,
      body: `Linked task ${number}`,
      items: options.liveItems ?? [
        liveItem(BOARD_PROJECT_ID, story, `ITEM_${number}`),
      ],
    });
  };

  run = (
    overrides: Partial<StoryGateCheckInput> = {},
  ): Promise<StoryGateCheckOutput> => {
    const boardCacheRepository: StoryGateBoardCacheRepository = {
      listBoardCachesNewestFirst: async () => this.caches,
    };
    const projectConfigRepository: StoryGateProjectConfigRepository = {
      listProjectConfigs: async () => this.configs,
    };
    return new StoryGateCheckUseCase(
      this.repository,
      boardCacheRepository,
      projectConfigRepository,
    ).run({ ...DEFAULT_INPUT, ...overrides });
  };
}

const adoptionScenario = (
  linkedStory: string,
  bodySuffix = '',
): StoryGateScenario => {
  const scenario = new StoryGateScenario({
    story: null,
    body: `${agentBodyLinking(2)}${bodySuffix}`,
  });
  scenario.linkedTaskAdd(2, linkedStory);
  return scenario;
};

const outputContentOf = (
  output: StoryGateCheckOutput,
  filePath: string | undefined,
): string =>
  output.outputFiles.find((file) => file.path === filePath)?.content ?? '';

describe('StoryGateCheckUseCase', () => {
  describe('result shape', () => {
    it('returns every result field with schema version 1', async () => {
      const scenario = new StoryGateScenario();

      const { result } = await scenario.run();

      expect(Object.keys(result)).toEqual(
        expect.arrayContaining([
          'schemaVersion',
          'issueUrl',
          'dryRun',
          'action',
          'reason',
          'story',
          'storyAdoption',
          'routingJson',
          'specificationMissingRoutingJson',
          'activeStoryOptions',
          'storyIssues',
          'assignedIssue',
          'specification',
          'facts',
        ]),
      );
      expect(result.schemaVersion).toBe(1);
      expect(result.issueUrl).toBe(issueUrl(ASSIGNED));
      expect(result.dryRun).toBe(false);
      expect(Object.keys(result.facts)).toEqual(
        expect.arrayContaining([
          'openClosingPullRequestUrls',
          'mergedClosingPullRequestUrls',
          'parentCandidateUrls',
          'parentHasApprovedSpecification',
          'storyIssueUrlsNotFound',
        ]),
      );
    });
  });

  describe('Story lookup', () => {
    it('uses the Story of the newest board cache when the issue is cached twice', async () => {
      const scenario = new StoryGateScenario({ story: 'feature A' });
      scenario.caches = [
        boardCache({
          filePath: 'cache/beta/allIssues-PVT_board/latest.json',
          modifiedAt: new Date('2026-09-20T00:00:00Z'),
          issues: [cacheIssue(ASSIGNED, 'feature B')],
        }),
        boardCache({
          filePath: 'cache/alpha/allIssues-PVT_board/latest.json',
          modifiedAt: new Date('2026-09-01T00:00:00Z'),
          issues: [cacheIssue(ASSIGNED, 'feature A')],
        }),
      ];

      const { result } = await scenario.run();

      expect(result.story).toEqual({
        value: 'feature B',
        source: 'BOARD_CACHE',
        adoptedFromUrls: [],
      });
      expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
        issueUrl(101),
      ]);
    });

    const liveFallbackCases: { name: string; options: AssignedIssueOptions }[] =
      [
        { name: 'in no board cache', options: { story: null, inCache: false } },
        { name: 'cached with an empty Story', options: { story: '' } },
        { name: 'cached without a Story', options: { story: null } },
        { name: 'cached with NO STORY', options: { story: 'NO STORY' } },
        {
          name: 'cached with a lower-case no story value',
          options: { story: 'no story (to be decided)' },
        },
      ];

    it.each(liveFallbackCases)(
      'reads the live Story when the issue is $name',
      async ({ options }) => {
        const scenario = new StoryGateScenario({
          ...options,
          liveItems: [
            liveItem(BOARD_PROJECT_ID, 'regular / chores', `ITEM_${ASSIGNED}`),
          ],
        });

        const { result } = await scenario.run();

        expect(result.story.value).toBe('regular / chores');
        expect(result.story.source).toBe('LIVE');
        expect(result.action).toBe('PROCEED');
        expect(result.reason).toBe('REGULAR_STORY');
        expect(scenario.repository.updates).toEqual([]);
      },
    );

    const notOnBoardCases: { name: string; liveItems: IssueProjectItem[] }[] = [
      { name: 'has no project item', liveItems: [] },
      {
        name: 'has an unset Story on a board without a cache',
        liveItems: [liveItem(OTHER_PROJECT_ID, null, 'ITEM_other_1')],
      },
    ];

    it.each(notOnBoardCases)(
      'proceeds with NOT_ON_ANY_BOARD when the uncached issue $name',
      async ({ liveItems }) => {
        const scenario = new StoryGateScenario({
          story: null,
          inCache: false,
          liveItems,
        });

        const { result } = await scenario.run();

        expect(result.action).toBe('PROCEED');
        expect(result.reason).toBe('NOT_ON_ANY_BOARD');
        expect(result.routingJson).toBeNull();
        expect(scenario.repository.updates).toEqual([]);
      },
    );

    it('proceeds with REGULAR_STORY without reading any story issue', async () => {
      const scenario = new StoryGateScenario({ story: 'regular / chores' });

      const { result } = await scenario.run();

      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('REGULAR_STORY');
      expect(result.storyIssues).toEqual([]);
      expect(scenario.repository.issueReads).not.toContain(issueUrl(102));
    });
  });

  describe('Story adoption', () => {
    it.each([
      {
        name: 'a feature Story',
        linkedStory: 'feature A',
        bodySuffix: '',
        optionId: 'OPT_feature_a',
        storyIssueUrl: issueUrl(100),
      },
      {
        name: 'a Backlog milestone Story with a backlog.com ticket URL',
        linkedStory: 'milestone on Backlog 2026',
        bodySuffix: '\nTicket: https://example.backlog.com/view/EXAMPLE-1',
        optionId: 'OPT_backlog',
        storyIssueUrl: issueUrl(103),
      },
      {
        name: 'a Backlog milestone Story with a backlog.jp ticket URL',
        linkedStory: 'milestone on Backlog 2026',
        bodySuffix: '\nTicket: https://example.backlog.jp/view/EXAMPLE-2',
        optionId: 'OPT_backlog',
        storyIssueUrl: issueUrl(103),
      },
    ])(
      'writes $name adopted from the only linked task and reads its story issue',
      async ({ linkedStory, bodySuffix, optionId, storyIssueUrl }) => {
        const scenario = adoptionScenario(linkedStory, bodySuffix);

        const { result } = await scenario.run();

        expect(scenario.repository.updates).toEqual([
          {
            projectId: BOARD_PROJECT_ID,
            itemId: `ITEM_${ASSIGNED}`,
            fieldId: STORY_FIELD_ID,
            optionId,
          },
        ]);
        expect(result.storyAdoption.outcome).toBe('WRITTEN');
        expect(result.story).toEqual({
          value: linkedStory,
          source: 'ADOPTED',
          adoptedFromUrls: [issueUrl(2)],
        });
        expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
          storyIssueUrl,
        ]);
        expect(result.action).toBe('PROCEED');
        expect(result.reason).toBe('STORY_ISSUE_READ');
      },
    );

    const noUniqueCases: {
      name: string;
      body: string;
      linked: { number: number; story: string }[];
    }[] = [
      {
        name: 'the body does not start with the agent report prefix',
        body: ['Related tasks:', `- ${issueUrl(2)}`].join('\n'),
        linked: [{ number: 2, story: 'feature A' }],
      },
      {
        name: 'the linked tasks carry two distinct Stories',
        body: agentBodyLinking(2, 3),
        linked: [
          { number: 2, story: 'feature A' },
          { number: 3, story: 'feature B' },
        ],
      },
      {
        name: 'the linked Story option is GRAY',
        body: agentBodyLinking(2),
        linked: [{ number: 2, story: 'retired story' }],
      },
      {
        name: 'the linked Story contains NO STORY',
        body: agentBodyLinking(2),
        linked: [{ number: 2, story: 'NO STORY' }],
      },
      {
        name: 'the linked Story is a Backlog milestone and the body has no Backlog ticket URL',
        body: agentBodyLinking(2),
        linked: [{ number: 2, story: 'milestone on Backlog 2026' }],
      },
      {
        name: 'the only link is the issue itself',
        body: agentBodyLinking(ASSIGNED),
        linked: [],
      },
    ];

    it.each(noUniqueCases)(
      'writes nothing and reports NO_UNIQUE_LINKED_STORY when $name',
      async ({ body, linked }) => {
        const scenario = new StoryGateScenario({ story: null, body });
        linked.forEach(({ number, story }) =>
          scenario.linkedTaskAdd(number, story),
        );

        const { result } = await scenario.run();

        expect(scenario.repository.updates).toEqual([]);
        expect(result.storyAdoption.outcome).toBe('NO_UNIQUE_LINKED_STORY');
        expect(result.action).toBe('ROUTE');
        expect(result.reason).toBe('STORY_NOT_ADOPTABLE');
        expect(result.routingJson).toEqual(ROUTING_JSON);
      },
    );

    it('stops reading links once two distinct Stories are found', async () => {
      const scenario = new StoryGateScenario({
        story: null,
        body: agentBodyLinking(2, 3, 4),
      });
      scenario.linkedTaskAdd(2, 'feature A');
      scenario.linkedTaskAdd(3, 'feature B');
      scenario.linkedTaskAdd(4, 'feature A', { inCache: false });

      const { result } = await scenario.run();

      expect(result.storyAdoption.outcome).toBe('NO_UNIQUE_LINKED_STORY');
      expect(scenario.repository.projectItemReads).not.toContain(issueUrl(4));
      expect(scenario.repository.updates).toEqual([]);
    });

    it.each([
      {
        name: 'counts the same-board item of a linked task absent from the board cache',
        body: agentBodyLinking(2),
        setup: (scenario: StoryGateScenario): void =>
          scenario.linkedTaskAdd(2, null, {
            inCache: false,
            liveItems: [
              liveItem(OTHER_PROJECT_ID, 'feature B', 'ITEM_other_2'),
              liveItem(BOARD_PROJECT_ID, 'feature A', 'ITEM_2'),
            ],
          }),
        adoptedFromUrls: [issueUrl(2)],
      },
      {
        name: 'ignores the other-board Story of a linked task absent from the board cache',
        body: agentBodyLinking(2, 3),
        setup: (scenario: StoryGateScenario): void => {
          scenario.linkedTaskAdd(2, null, {
            inCache: false,
            liveItems: [
              liveItem(OTHER_PROJECT_ID, 'feature B', 'ITEM_other_2'),
            ],
          });
          scenario.linkedTaskAdd(3, 'feature A');
        },
        adoptedFromUrls: [issueUrl(3)],
      },
    ])('$name', async ({ body, setup, adoptedFromUrls }) => {
      const scenario = new StoryGateScenario({ story: null, body });
      setup(scenario);

      const { result } = await scenario.run();

      expect(scenario.repository.projectItemReads).toContain(issueUrl(2));
      expect(result.storyAdoption.outcome).toBe('WRITTEN');
      expect(result.story).toEqual({
        value: 'feature A',
        source: 'ADOPTED',
        adoptedFromUrls,
      });
      expect(scenario.repository.updates).toEqual([
        {
          projectId: BOARD_PROJECT_ID,
          itemId: `ITEM_${ASSIGNED}`,
          fieldId: STORY_FIELD_ID,
          optionId: 'OPT_feature_a',
        },
      ]);
    });

    it('reports NO_UNIQUE_LINKED_STORY when the uncached linked task has a Story only on another board', async () => {
      const scenario = new StoryGateScenario({
        story: null,
        body: agentBodyLinking(2),
      });
      scenario.linkedTaskAdd(2, null, {
        inCache: false,
        liveItems: [liveItem(OTHER_PROJECT_ID, 'feature A', 'ITEM_other_2')],
      });

      const { result } = await scenario.run();

      expect(result.storyAdoption.outcome).toBe('NO_UNIQUE_LINKED_STORY');
      expect(scenario.repository.updates).toEqual([]);
    });

    it('sends no mutation on a dry run and continues with the linked Story', async () => {
      const scenario = adoptionScenario('feature A');

      const { result } = await scenario.run({ dryRun: true });

      expect(scenario.repository.updates).toEqual([]);
      expect(result.dryRun).toBe(true);
      expect(result.storyAdoption.outcome).toBe('SKIPPED_DRY_RUN');
      expect(result.story.value).toBe('feature A');
      expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
        issueUrl(100),
      ]);
      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('STORY_ISSUE_READ');
    });

    it('keeps a Story set live before the write and continues with it', async () => {
      const scenario = adoptionScenario('feature A');
      scenario.repository.queuedProjectItems.set(issueUrl(ASSIGNED), [
        {
          state: 'OPEN',
          items: [liveItem(BOARD_PROJECT_ID, null, `ITEM_${ASSIGNED}`)],
        },
      ]);
      scenario.repository.projectItems.set(issueUrl(ASSIGNED), {
        state: 'OPEN',
        items: [liveItem(BOARD_PROJECT_ID, 'feature B', `ITEM_${ASSIGNED}`)],
      });

      const { result } = await scenario.run();

      expect(scenario.repository.updates).toEqual([]);
      expect(result.storyAdoption.outcome).toBe('LIVE_STORY_ALREADY_SET');
      expect(result.story.value).toBe('feature B');
      expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
        issueUrl(101),
      ]);
      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('STORY_ISSUE_READ');
    });

    it('reports READ_BACK_MISMATCH and routes when the read-back differs', async () => {
      const scenario = adoptionScenario('feature A');
      scenario.repository.appliesUpdates = false;

      const { result } = await scenario.run();

      expect(scenario.repository.updates).toHaveLength(1);
      expect(result.storyAdoption.outcome).toBe('READ_BACK_MISMATCH');
      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('STORY_NOT_ADOPTABLE');
      expect(result.routingJson).toEqual(ROUTING_JSON);
    });
  });

  describe('unresolved Story', () => {
    it('routes with ISSUE_NOT_IN_BOARD_CACHE when a live item belongs to a cached board', async () => {
      const scenario = new StoryGateScenario({
        story: null,
        inCache: false,
        liveItems: [liveItem(BOARD_PROJECT_ID, null, `ITEM_${ASSIGNED}`)],
      });

      const { result } = await scenario.run();

      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('ISSUE_NOT_IN_BOARD_CACHE');
      expect(result.routingJson).toEqual(ROUTING_JSON);
    });

    const notAdoptableCases: {
      name: string;
      configs: StoryGateProjectConfig[];
      closingPullRequests: ClosingPullRequest[];
    }[] = [
      {
        name: 'no project config exists',
        configs: [],
        closingPullRequests: [],
      },
      {
        name: 'no project config org matches the issue owner',
        configs: [
          {
            filePath: 'config/another.config.yaml',
            org: 'another-org',
            agents: ['developer-agent'],
          },
        ],
        closingPullRequests: [],
      },
      {
        name: 'the agent is a project agent and no pull request closes the issue',
        configs: [DEFAULT_CONFIG],
        closingPullRequests: [],
      },
      {
        name: 'the agent is a project agent and only a closed pull request closes the issue',
        configs: [DEFAULT_CONFIG],
        closingPullRequests: [{ url: pullRequestUrl(9), state: 'CLOSED' }],
      },
    ];

    it.each(notAdoptableCases)(
      'routes with STORY_NOT_ADOPTABLE when $name',
      async ({ configs, closingPullRequests }) => {
        const scenario = new StoryGateScenario({
          story: null,
          closingPullRequests,
        });
        scenario.configs = configs;

        const { result } = await scenario.run();

        expect(result.storyAdoption.outcome).toBe('NO_UNIQUE_LINKED_STORY');
        expect(result.action).toBe('ROUTE');
        expect(result.reason).toBe('STORY_NOT_ADOPTABLE');
        expect(result.routingJson).toEqual(ROUTING_JSON);
      },
    );

    const selfResolveCases: {
      name: string;
      configs: StoryGateProjectConfig[];
      closingPullRequests: ClosingPullRequest[];
      reason: string;
    }[] = [
      {
        name: 'the agent is absent from the project agents',
        configs: [{ ...DEFAULT_CONFIG, agents: ['other-agent'] }],
        closingPullRequests: [],
        reason: 'AGENT_NOT_IN_PROJECT_AGENTS',
      },
      {
        name: 'the project config org differs from the owner only in letter case',
        configs: [
          { ...DEFAULT_CONFIG, org: 'Example-Org', agents: ['other-agent'] },
        ],
        closingPullRequests: [],
        reason: 'AGENT_NOT_IN_PROJECT_AGENTS',
      },
      {
        name: 'an open pull request closes the issue',
        configs: [DEFAULT_CONFIG],
        closingPullRequests: [{ url: pullRequestUrl(9), state: 'OPEN' }],
        reason: 'OPEN_PULL_REQUEST_EXISTS',
      },
    ];

    it.each(selfResolveCases)(
      'asks the agent to resolve the Story when $name',
      async ({ configs, closingPullRequests, reason }) => {
        const scenario = new StoryGateScenario({
          story: null,
          closingPullRequests,
        });
        scenario.configs = configs;

        const { result } = await scenario.run();

        expect(result.action).toBe('SELF_RESOLVE_STORY');
        expect(result.reason).toBe(reason);
        expect(result.activeStoryOptions).toEqual(ACTIVE_STORY_OPTION_NAMES);
      },
    );

    it('reports the open closing pull request in the facts', async () => {
      const scenario = new StoryGateScenario({
        story: null,
        closingPullRequests: [
          { url: pullRequestUrl(9), state: 'OPEN' },
          { url: pullRequestUrl(8), state: 'MERGED' },
        ],
      });

      const { result } = await scenario.run();

      expect(result.reason).toBe('OPEN_PULL_REQUEST_EXISTS');
      expect(result.facts.openClosingPullRequestUrls).toEqual([
        pullRequestUrl(9),
      ]);
    });
  });

  describe('triage agent self-routing guard', () => {
    it('proceeds instead of routing to itself when ISSUE_NOT_IN_BOARD_CACHE would otherwise apply', async () => {
      const scenario = new StoryGateScenario({
        story: null,
        inCache: false,
        liveItems: [liveItem(BOARD_PROJECT_ID, null, `ITEM_${ASSIGNED}`)],
      });

      const { result } = await scenario.run({
        agentName: 'triage-agent',
        triageAgentName: 'triage-agent',
      });

      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF');
      expect(result.routingJson).toBeNull();
    });

    it('resolves itself instead of routing to itself when STORY_NOT_ADOPTABLE would otherwise apply', async () => {
      const scenario = new StoryGateScenario({ story: null });
      scenario.configs = [];

      const { result } = await scenario.run({
        agentName: 'triage-agent',
        triageAgentName: 'triage-agent',
      });

      expect(result.action).toBe('SELF_RESOLVE_STORY');
      expect(result.reason).toBe('TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF');
      expect(result.routingJson).toBeNull();
    });

    it('proceeds instead of routing to itself when STORY_ISSUE_NOT_FOUND would otherwise apply', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: {},
      });

      const { result } = await scenario.run({
        agentName: 'triage-agent',
        triageAgentName: 'triage-agent',
      });

      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF');
      expect(result.routingJson).toBeNull();
    });

    it('proceeds instead of routing to itself when STORY_ISSUES_NOT_READABLE would otherwise apply', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: { 'feature A': issueUrl(108) },
      });

      const { result } = await scenario.run({
        agentName: 'triage-agent',
        triageAgentName: 'triage-agent',
      });

      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('TRIAGE_AGENT_CANNOT_ROUTE_TO_SELF');
      expect(result.routingJson).toBeNull();
    });
  });

  describe('story issue lookup', () => {
    it('does not take the story issue URL from the map of another board cache', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: {},
      });
      scenario.caches.push(
        boardCache({
          filePath: 'cache/other/allIssues-PVT_other/latest.json',
          modifiedAt: new Date('2026-08-01T00:00:00Z'),
          projectId: OTHER_PROJECT_ID,
          storyIssueUrlByOptionName: { 'feature A': issueUrl(104) },
        }),
      );
      scenario.repository.issueAdd({
        number: 104,
        body: 'Story issue from another board',
        labels: ['story'],
      });

      const { result } = await scenario.run();

      expect(result.storyIssues).toEqual([]);
      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('STORY_ISSUE_NOT_FOUND');
    });

    it.each([
      {
        name: 'the assigned issue is cached on board A',
        inCache: true,
        otherBoardStoryIssueUrlByOptionName: { 'feature A': issueUrl(200) },
        otherBoardIssueRegister: (scenario: StoryGateScenario): void =>
          scenario.repository.issueAdd({ number: 200, labels: ['story'] }),
      },
      {
        name: "the assigned issue is in no board cache and its owner matches board A's configured org",
        inCache: false,
        otherBoardStoryIssueUrlByOptionName: {
          'feature A': otherOrgIssueUrl(200),
        },
        otherBoardIssueRegister: (scenario: StoryGateScenario): void =>
          scenario.repository.issueAddAtUrl(otherOrgIssueUrl(200), {
            labels: ['story'],
          }),
      },
    ])(
      "returns only board A's story issue URL when $name, even though board B also resolves the same Story name and board B's own story issue is readable",
      async ({
        inCache,
        otherBoardStoryIssueUrlByOptionName,
        otherBoardIssueRegister,
      }) => {
        const scenario = new StoryGateScenario({ story: 'feature A', inCache });
        otherBoardIssueRegister(scenario);
        scenario.caches.push(
          boardCache({
            filePath: 'cache/other-board/allIssues-PVT_other/latest.json',
            modifiedAt: new Date('2026-08-01T00:00:00Z'),
            projectId: OTHER_PROJECT_ID,
            issues: [],
            storyIssueUrlByOptionName: otherBoardStoryIssueUrlByOptionName,
          }),
        );

        const { result } = await scenario.run();

        expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
          issueUrl(100),
        ]);
        expect(result.action).toBe('PROCEED');
        expect(result.reason).toBe('STORY_ISSUE_READ');
      },
    );

    it('skips the board-cache scoping for a story name starting with "regular /" even with multiple caches', async () => {
      const scenario = new StoryGateScenario({ story: 'regular / chores' });
      scenario.caches.push(
        boardCache({
          filePath: 'cache/other-board/allIssues-PVT_other/latest.json',
          modifiedAt: new Date('2026-08-01T00:00:00Z'),
          projectId: OTHER_PROJECT_ID,
          issues: [],
          storyIssueUrlByOptionName: {},
        }),
      );

      const { result } = await scenario.run();

      expect(result.storyIssues).toEqual([]);
      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('REGULAR_STORY');
    });

    it('falls back to cached issues carrying the Story and the story label', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: {},
        cacheIssues: [
          cacheIssue(105, 'feature A', { labels: ['story'] }),
          cacheIssue(106, 'feature A'),
          cacheIssue(107, 'feature B', { labels: ['story'] }),
        ],
      });
      [105, 106, 107].forEach((number) =>
        scenario.repository.issueAdd({ number, body: `Issue ${number}` }),
      );

      const { result } = await scenario.run();

      expect(result.storyIssues.map((storyIssue) => storyIssue.url)).toEqual([
        issueUrl(105),
      ]);
      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('STORY_ISSUE_READ');
    });

    it('routes with STORY_ISSUE_NOT_FOUND when no story issue URL exists', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: {},
      });

      const { result } = await scenario.run();

      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('STORY_ISSUE_NOT_FOUND');
      expect(result.routingJson).toEqual(ROUTING_JSON);
    });

    it('routes with STORY_ISSUES_NOT_READABLE when every story issue URL is not found', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: { 'feature A': issueUrl(108) },
      });

      const { result } = await scenario.run();

      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('STORY_ISSUES_NOT_READABLE');
      expect(result.routingJson).toEqual(ROUTING_JSON);
      expect(result.facts.storyIssueUrlsNotFound).toEqual([issueUrl(108)]);
    });

    it('does not fall back to the story issue URL of a different board cache when its own is not found', async () => {
      const scenario = new StoryGateScenario({
        story: 'feature A',
        storyIssueUrlByOptionName: { 'feature A': issueUrl(108) },
      });
      scenario.caches.push(
        boardCache({
          filePath: 'cache/other/allIssues-PVT_other/latest.json',
          modifiedAt: new Date('2026-08-01T00:00:00Z'),
          projectId: OTHER_PROJECT_ID,
          storyIssueUrlByOptionName: { 'feature A': issueUrl(100) },
        }),
      );

      const { result } = await scenario.run();

      expect(result.storyIssues).toEqual([]);
      expect(result.facts.storyIssueUrlsNotFound).toEqual([issueUrl(108)]);
      expect(result.action).toBe('ROUTE');
      expect(result.reason).toBe('STORY_ISSUES_NOT_READABLE');
    });

    it('writes the story issue body and comment files under the output directory', async () => {
      const ownerComments = numbered('owner-comment', 50);
      const agentAfterFold = numbered('agent-after-fold', 45).map((text) =>
        text === 'agent-after-fold-044'
          ? agentComment(`## Fold notes\n${text}`)
          : agentComment(text),
      );
      const scenario = new StoryGateScenario({ story: 'feature A' });
      scenario.repository.issueAdd({
        number: 100,
        body: 'story-issue-body-text',
        labels: ['story'],
        comments: [
          ...ownerComments.slice(0, 25),
          agentComment('agent-before-fold'),
          FOLD_COMMENT,
          ...ownerComments.slice(25),
          ...agentAfterFold,
        ],
      });

      const output = await scenario.run();
      const [storyIssue] = output.result.storyIssues;

      expect(output.result.storyIssues).toHaveLength(1);
      expect(storyIssue).toEqual(
        expect.objectContaining({
          url: issueUrl(100),
          state: 'OPEN',
          ownerCommentCount: 50,
          agentCommentCountRead: 40,
        }),
      );
      expect(storyIssue.agentCommentCountTotal).toBeGreaterThanOrEqual(45);
      const paths = [
        storyIssue.bodyPath,
        storyIssue.ownerCommentsPath,
        storyIssue.agentCommentsPath,
      ];
      paths.forEach((filePath) =>
        expect(filePath.startsWith(`${OUTPUT_DIRECTORY}/`)).toBe(true),
      );
      expect(new Set(paths).size).toBe(3);
      expect(output.outputFiles.map((file) => file.path)).toEqual(
        expect.arrayContaining(paths),
      );
      expect(outputContentOf(output, storyIssue.bodyPath)).toContain(
        'story-issue-body-text',
      );
      const ownerContent = outputContentOf(
        output,
        storyIssue.ownerCommentsPath,
      );
      ownerComments.forEach((body) => expect(ownerContent).toContain(body));
      expect(ownerContent).not.toContain('agent-after-fold');
      const agentContent = outputContentOf(
        output,
        storyIssue.agentCommentsPath,
      );
      numbered('agent-after-fold', 45)
        .slice(5)
        .forEach((text) => expect(agentContent).toContain(text));
      numbered('agent-after-fold', 5).forEach((text) =>
        expect(agentContent).not.toContain(text),
      );
      expect(agentContent).not.toContain('agent-before-fold');
      expect(agentContent).not.toContain('fold-summary');
      expect(agentContent).not.toContain('owner-comment');
      expect(agentContent.indexOf('agent-after-fold-045')).toBeLessThan(
        agentContent.indexOf('agent-after-fold-006'),
      );
    });

    it.each([
      {
        name: 'every readable story issue is closed',
        states: ['CLOSED', 'CLOSED'],
        action: 'STOP_SILENT',
        reason: 'STORY_ISSUE_CLOSED',
      },
      {
        name: 'the only readable story issue is closed and the other is not found',
        states: ['CLOSED', 'MISSING'],
        action: 'STOP_SILENT',
        reason: 'STORY_ISSUE_CLOSED',
      },
      {
        name: 'one readable story issue is still open',
        states: ['CLOSED', 'OPEN'],
        action: 'PROCEED',
        reason: 'STORY_ISSUE_READ',
      },
      {
        name: 'every story issue is open',
        states: ['OPEN', 'OPEN'],
        action: 'PROCEED',
        reason: 'STORY_ISSUE_READ',
      },
    ])(
      'returns $action with $reason when $name',
      async ({ states, action, reason }) => {
        const scenario = new StoryGateScenario({
          story: 'feature A',
          storyIssueUrlByOptionName: {},
          cacheIssues: [
            cacheIssue(100, 'feature A', { labels: ['story'] }),
            cacheIssue(104, 'feature A', { labels: ['story'] }),
          ],
        });
        [100, 104].forEach((number, index) => {
          const state = states[index];
          if (state === 'MISSING') {
            scenario.repository.issues.delete(issueUrl(number));
            return;
          }
          scenario.repository.issueAdd({
            number,
            state: state === 'CLOSED' ? 'CLOSED' : 'OPEN',
            labels: ['story'],
          });
        });

        const { result } = await scenario.run();

        expect(result.action).toBe(action);
        expect(result.reason).toBe(reason);
      },
    );
  });

  describe('assigned issue checks', () => {
    const closedCases: { name: string; options: AssignedIssueOptions }[] = [
      { name: 'a feature Story', options: { story: 'feature A' } },
      { name: 'a regular Story', options: { story: 'regular / chores' } },
      {
        name: 'no board',
        options: { story: null, inCache: false, liveItems: [] },
      },
    ];

    it.each(closedCases)(
      'stops silently with ISSUE_CLOSED for a closed issue on $name',
      async ({ options }) => {
        const scenario = new StoryGateScenario({ ...options, state: 'CLOSED' });

        const { result } = await scenario.run();

        expect(result.action).toBe('STOP_SILENT');
        expect(result.reason).toBe('ISSUE_CLOSED');
      },
    );

    it.each([
      {
        name: 'the newest comment routes to the specification agent',
        comments: ['owner question', specificationRoutingComment('spec-agent')],
        action: 'STOP_SILENT',
        reason: 'SPECIFICATION_ROUTING_ALREADY_POSTED',
      },
      {
        name: 'the newest comment routes to another agent',
        comments: [
          'owner question',
          specificationRoutingComment('other-agent'),
        ],
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
      },
      {
        name: 'a newer comment follows the specification routing comment',
        comments: [
          specificationRoutingComment('spec-agent'),
          'owner follow-up',
        ],
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
      },
    ])(
      'returns $action with $reason when $name',
      async ({ comments, action, reason }) => {
        const scenario = new StoryGateScenario({
          story: 'regular / chores',
          comments,
        });

        const { result } = await scenario.run();

        expect(result.action).toBe(action);
        expect(result.reason).toBe(reason);
      },
    );

    it.each([
      {
        name: 'stops silently when another agent meets the posted routing to the specification agent',
        agentName: 'developer',
        action: 'STOP_SILENT',
        reason: 'SPECIFICATION_ROUTING_ALREADY_POSTED',
      },
      {
        name: 'proceeds when the specification agent itself meets the posted routing to it',
        agentName: 'spec-creator',
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
      },
    ])('$name', async ({ agentName, action, reason }) => {
      const scenario = new StoryGateScenario({
        story: 'regular / chores',
        body: [
          '## Requirements',
          '1. Show the list',
          '',
          '## Acceptance Criteria',
          '1. The list is shown',
        ].join('\n'),
        comments: [
          'owner question',
          specificationRoutingComment('spec-creator'),
        ],
      });

      const { result } = await scenario.run({
        agentName,
        specificationAgentName: 'spec-creator',
      });

      expect(result.action).toBe(action);
      expect(result.reason).toBe(reason);
    });

    it.each([
      {
        name: '41 comments without the story label',
        labels: [],
        comments: numbered('comment', 41),
        action: 'FOLD_REQUIRED',
        reason: 'COMMENT_HISTORY_OVER_LIMIT',
        foldMode: 'NEW_ISSUE',
      },
      {
        name: '41 comments with an early fold and without the story label',
        labels: [],
        comments: [FOLD_COMMENT, ...numbered('comment', 40)],
        action: 'FOLD_REQUIRED',
        reason: 'COMMENT_HISTORY_OVER_LIMIT',
        foldMode: 'NEW_ISSUE',
      },
      {
        name: '40 comments without the story label',
        labels: [],
        comments: numbered('comment', 40),
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
        foldMode: undefined,
      },
      {
        name: '41 comments after the latest fold with the story label',
        labels: ['story'],
        comments: [
          ...numbered('early', 10),
          FOLD_COMMENT,
          ...numbered('comment', 41),
        ],
        action: 'FOLD_REQUIRED',
        reason: 'COMMENT_HISTORY_OVER_LIMIT',
        foldMode: 'IN_PLACE',
      },
      {
        name: '41 comments without any fold with the story label',
        labels: ['story'],
        comments: numbered('comment', 41),
        action: 'FOLD_REQUIRED',
        reason: 'COMMENT_HISTORY_OVER_LIMIT',
        foldMode: 'IN_PLACE',
      },
      {
        name: '40 comments after the latest fold with the story label',
        labels: ['story'],
        comments: [
          ...numbered('early', 30),
          FOLD_COMMENT,
          ...numbered('comment', 40),
        ],
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
        foldMode: undefined,
      },
    ])(
      'returns $action for $name',
      async ({ labels, comments, action, reason, foldMode }) => {
        const scenario = new StoryGateScenario({
          story: 'regular / chores',
          labels,
          comments,
        });

        const { result } = await scenario.run();

        expect(result.action).toBe(action);
        expect(result.reason).toBe(reason);
        if (foldMode !== undefined) {
          expect(result.assignedIssue?.foldMode).toBe(foldMode);
        }
      },
    );

    it('writes the owner and agent comment files of a story-labelled assigned issue', async () => {
      const scenario = new StoryGateScenario({
        story: 'regular / chores',
        labels: ['story'],
        comments: [
          'owner-request',
          agentComment('first-report'),
          'owner-follow-up',
          agentComment('second-report'),
        ],
      });

      const output = await scenario.run();
      const commentFiles = output.result.assignedIssue?.commentFiles;

      expect(commentFiles).toMatchObject({
        ownerCommentCount: 2,
        agentCommentCountRead: 2,
        agentCommentCountTotal: 2,
      });
      [
        commentFiles?.ownerCommentsPath,
        commentFiles?.agentCommentsPath,
      ].forEach((filePath) =>
        expect(filePath?.startsWith(`${OUTPUT_DIRECTORY}/`)).toBe(true),
      );
      expect(output.outputFiles.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          commentFiles?.ownerCommentsPath,
          commentFiles?.agentCommentsPath,
        ]),
      );
      const ownerContent = outputContentOf(
        output,
        commentFiles?.ownerCommentsPath,
      );
      expect(ownerContent).toContain('owner-request');
      expect(ownerContent).toContain('owner-follow-up');
      expect(ownerContent).not.toContain('first-report');
      const agentContent = outputContentOf(
        output,
        commentFiles?.agentCommentsPath,
      );
      expect(agentContent).not.toContain('owner-request');
      expect(agentContent.indexOf('second-report')).toBeGreaterThanOrEqual(0);
      expect(agentContent.indexOf('second-report')).toBeLessThan(
        agentContent.indexOf('first-report'),
      );
    });
  });

  describe('specification detection', () => {
    const PROSE_COMPLETION_BODY = [
      '## 要件',
      '1. 一覧を表示する',
      '',
      '## 完了条件',
      '一覧が表示されること。',
    ].join('\n');
    const FR_SC_BODY = [
      '## Functional Requirements',
      '- FR-001: The list MUST be sortable',
      '',
      '## Success Criteria',
      '- SC-001: Sorting finishes within one second',
    ].join('\n');
    const NUMBERED_BODY = [
      '## Requirements',
      '1. Show the list',
      '',
      '## Acceptance Criteria',
      '1. The list is shown',
    ].join('\n');
    const bodyLinking = (text: string): string =>
      [text, '', `Parent: ${issueUrl(5)}`, `Related: ${issueUrl(7)}`].join(
        '\n',
      );
    const namingComment = `Owner note\n承認済み仕様: ${issueUrl(6)}`;

    it('lists the assigned, linked and comment-named candidates in order', async () => {
      const scenario = new StoryGateScenario({
        story: 'regular / chores',
        body: bodyLinking(PROSE_COMPLETION_BODY),
        comments: [namingComment],
      });
      scenario.repository.issueAdd({ number: 5, body: FR_SC_BODY });
      scenario.repository.issueAdd({
        number: 7,
        body: 'No specification here',
      });
      scenario.repository.issueAdd({ number: 6, body: NUMBERED_BODY });

      const { result } = await scenario.run();

      expect(result.specification?.candidates).toEqual([
        {
          url: issueUrl(ASSIGNED),
          source: 'SELF',
          hasNumberedRequirements: true,
          hasNumberedCriteria: false,
        },
        {
          url: issueUrl(5),
          source: 'LINKED_IN_BODY',
          hasNumberedRequirements: true,
          hasNumberedCriteria: true,
        },
        {
          url: issueUrl(7),
          source: 'LINKED_IN_BODY',
          hasNumberedRequirements: false,
          hasNumberedCriteria: false,
        },
        {
          url: issueUrl(6),
          source: 'NAMED_IN_COMMENT',
          hasNumberedRequirements: true,
          hasNumberedCriteria: true,
        },
      ]);
      expect(result.specification?.detectedUrl).toBe(issueUrl(5));
    });

    it('lists an unreadable linked candidate separately and decides from the readable candidates', async () => {
      const scenario = new StoryGateScenario({
        story: 'regular / chores',
        body: bodyLinking(PROSE_COMPLETION_BODY),
        comments: [],
      });
      scenario.repository.issueAdd({
        number: 7,
        body: 'No specification here',
      });
      scenario.repository.issueUnreadableUrlAdd(issueUrl(5));

      const { result } = await scenario.run();

      expect(result.specification?.unreadableUrls).toEqual([issueUrl(5)]);
      expect(
        result.specification?.candidates.map((candidate) => candidate.url),
      ).toEqual([issueUrl(ASSIGNED), issueUrl(7)]);
      expect(result.action).toBe('PROCEED');
      expect(result.reason).toBe('REGULAR_STORY');
    });

    it('propagates a linked candidate read failure that is not HTTP 403 or 404', async () => {
      const scenario = new StoryGateScenario({
        story: 'regular / chores',
        body: bodyLinking(PROSE_COMPLETION_BODY),
        comments: [],
      });
      scenario.repository.issueAdd({
        number: 7,
        body: 'No specification here',
      });
      scenario.repository.issueUnreadableUrlAdd(issueUrl(5), 500);

      await expect(scenario.run()).rejects.toThrow('returned HTTP 500');
    });

    it.each([
      {
        name: 'the assigned issue body when it qualifies first',
        selfBody: NUMBERED_BODY,
        linkedBody: FR_SC_BODY,
        namedBody: NUMBERED_BODY,
        expected: issueUrl(ASSIGNED),
      },
      {
        name: 'the comment-named issue when it is the only one qualifying',
        selfBody: PROSE_COMPLETION_BODY,
        linkedBody: PROSE_COMPLETION_BODY,
        namedBody: NUMBERED_BODY,
        expected: issueUrl(6),
      },
      {
        name: 'nothing when every completion section holds only prose',
        selfBody: PROSE_COMPLETION_BODY,
        linkedBody: PROSE_COMPLETION_BODY,
        namedBody: PROSE_COMPLETION_BODY,
        expected: null,
      },
    ])(
      'detects $name',
      async ({ selfBody, linkedBody, namedBody, expected }) => {
        const scenario = new StoryGateScenario({
          story: 'regular / chores',
          body: bodyLinking(selfBody),
          comments: [namingComment],
        });
        scenario.repository.issueAdd({ number: 5, body: linkedBody });
        scenario.repository.issueAdd({ number: 7, body: 'No specification' });
        scenario.repository.issueAdd({ number: 6, body: namedBody });

        const { result } = await scenario.run();

        expect(result.specification?.detectedUrl).toBe(expected);
      },
    );
  });

  describe('merged work without an approved specification', () => {
    const MERGED_PULL_REQUESTS: ClosingPullRequest[] = [
      { url: pullRequestUrl(9), state: 'MERGED' },
      { url: pullRequestUrl(8), state: 'CLOSED' },
    ];
    const bodyWithParent = `Implement the list screen\nParent: ${issueUrl(5)}`;
    const namingComment = `Owner note\n承認済み仕様: ${issueUrl(6)}`;

    const judgeCases: { name: string; options: AssignedIssueOptions }[] = [
      { name: 'a regular Story', options: { story: 'regular / chores' } },
      { name: 'a feature Story', options: { story: 'feature A' } },
      {
        name: 'more than 40 comments',
        options: {
          story: 'regular / chores',
          comments: [...numbered('comment', 41), namingComment],
        },
      },
    ];

    it.each(judgeCases)(
      'asks the agent to judge merged work on $name',
      async ({ options }) => {
        const scenario = new StoryGateScenario({
          body: bodyWithParent,
          comments: [namingComment],
          closingPullRequests: MERGED_PULL_REQUESTS,
          ...options,
        });
        scenario.repository.issueAdd({
          number: 5,
          body: 'Parent task without a specification',
        });
        scenario.repository.issueAdd({
          number: 6,
          body: '## 完了条件\nThe list is shown.',
        });

        const { result } = await scenario.run();

        expect(result.action).toBe('JUDGE');
        expect(result.reason).toBe(
          'WORK_MERGED_WITHOUT_APPROVED_SPECIFICATION',
        );
        expect(result.routingJson).toBeNull();
        expect(result.specification?.detectedUrl).toBeNull();
        expect(result.facts.mergedClosingPullRequestUrls).toEqual([
          pullRequestUrl(9),
        ]);
        expect(result.facts.parentCandidateUrls).toEqual([
          issueUrl(5),
          issueUrl(6),
        ]);
        expect(result.facts.parentHasApprovedSpecification).toBe(false);
      },
    );

    const notJudgeCases: {
      name: string;
      options: AssignedIssueOptions;
      action: string;
      reason: string;
    }[] = [
      {
        name: 'the assigned issue holds an approved specification',
        options: {
          body: `${[
            '## Requirements',
            '1. Show the list',
            '',
            '## Acceptance Criteria',
            '1. The list is shown',
          ].join('\n')}\nParent: ${issueUrl(5)}`,
        },
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
      },
      {
        name: 'only an open pull request closes the issue',
        options: {
          closingPullRequests: [{ url: pullRequestUrl(9), state: 'OPEN' }],
        },
        action: 'PROCEED',
        reason: 'REGULAR_STORY',
      },
      {
        name: 'the assigned issue is closed',
        options: { state: 'CLOSED' },
        action: 'STOP_SILENT',
        reason: 'ISSUE_CLOSED',
      },
      {
        name: 'the specification routing is already posted',
        options: {
          comments: [namingComment, specificationRoutingComment('spec-agent')],
        },
        action: 'STOP_SILENT',
        reason: 'SPECIFICATION_ROUTING_ALREADY_POSTED',
      },
    ];

    it.each(notJudgeCases)(
      'returns $action with $reason when $name',
      async ({ options, action, reason }) => {
        const scenario = new StoryGateScenario({
          story: 'regular / chores',
          body: bodyWithParent,
          comments: [namingComment],
          closingPullRequests: MERGED_PULL_REQUESTS,
          ...options,
        });
        scenario.repository.issueAdd({
          number: 5,
          body: 'Parent task without a specification',
        });
        scenario.repository.issueAdd({ number: 6, body: 'Named issue' });

        const { result } = await scenario.run();

        expect(result.action).toBe(action);
        expect(result.reason).toBe(reason);
      },
    );
  });
});
