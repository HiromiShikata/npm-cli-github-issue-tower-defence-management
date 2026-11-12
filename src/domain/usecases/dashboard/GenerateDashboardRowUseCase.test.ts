import { Issue } from '../../entities/Issue';
import {
  DashboardRow,
  GenerateDashboardRowUseCase,
} from './GenerateDashboardRowUseCase';

const ASSIGNEE = 'HiromiShikata';

let issueCounter = 0;
const makeIssue = (overrides: Partial<Issue>): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'demo/repo',
    number: issueCounter,
    title: `Issue ${issueCounter}`,
    state: 'OPEN',
    status: null,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: `https://github.com/demo/repo/issues/${issueCounter}`,
    assignees: [ASSIGNEE],
    labels: [],
    org: 'demo',
    repo: 'repo',
    body: '',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date('2026-06-13T08:18:45.000Z'),
    author: 'someone',
    closingIssueReferenceUrls: [],
    plainCrossRepoIssueReferenceUrls: [],
    agent: null,
    stateReason: null,
    ...overrides,
  };
};

type DashboardRowWithoutHumanPending = Omit<
  DashboardRow,
  'humanPendingRed' | 'humanPendingYellow'
>;

const zeroCountsWithoutHumanPending: DashboardRowWithoutHumanPending = {
  todo: 0,
  qc: 0,
  fail: 0,
  pr: 0,
  ws: 0,
  dep: 0,
  blocker: 0,
  consoleTodoByHumanCount: 0,
  consoleAwaitingOwnerCount: 0,
};

const withoutHumanPending = (
  row: DashboardRow,
): DashboardRowWithoutHumanPending => ({
  todo: row.todo,
  qc: row.qc,
  fail: row.fail,
  pr: row.pr,
  ws: row.ws,
  dep: row.dep,
  blocker: row.blocker,
  consoleTodoByHumanCount: row.consoleTodoByHumanCount,
  consoleAwaitingOwnerCount: row.consoleAwaitingOwnerCount,
});

describe('GenerateDashboardRowUseCase', () => {
  const usecase = new GenerateDashboardRowUseCase();

  beforeEach(() => {
    issueCounter = 0;
  });

  it('returns all-zero counts for an empty issue list', () => {
    expect(
      usecase.run({
        issues: [],
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      }),
    ).toEqual({
      todo: 0,
      qc: 0,
      fail: 0,
      pr: 0,
      ws: 0,
      dep: 0,
      blocker: 0,
      humanPendingRed: 0,
      humanPendingYellow: 0,
      consoleTodoByHumanCount: 0,
      consoleAwaitingOwnerCount: 0,
    });
  });

  it('counts actionable Todo, Awaiting Owner and Awaiting Workspace issues', () => {
    const issues = [
      makeIssue({ status: 'Todo by human' }),
      makeIssue({ status: 'Awaiting Owner' }),
      makeIssue({ status: 'Awaiting Workspace' }),
    ];

    expect(
      usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      }),
    ).toEqual({
      todo: 1,
      qc: 1,
      fail: 0,
      pr: 0,
      ws: 1,
      dep: 0,
      blocker: 0,
      humanPendingRed: 0,
      humanPendingYellow: 0,
      consoleTodoByHumanCount: 1,
      consoleAwaitingOwnerCount: 1,
    });
  });

  it('excludes non-actionable issues from actionable status columns', () => {
    const issues = [
      makeIssue({
        status: 'Awaiting Owner',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
      makeIssue({ status: 'Todo by human', assignees: ['someone-else'] }),
      makeIssue({ status: 'Awaiting Workspace', isClosed: true }),
    ];

    expect(
      usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      }),
    ).toEqual({
      todo: 0,
      qc: 0,
      fail: 0,
      pr: 0,
      ws: 0,
      dep: 0,
      blocker: 0,
      humanPendingRed: 0,
      humanPendingYellow: 0,
      consoleTodoByHumanCount: 0,
      consoleAwaitingOwnerCount: 0,
    });
  });

  it('counts Preparation and Failed Preparation by whole status without the actionable predicate', () => {
    const issues = [
      makeIssue({ status: 'Preparation', nextActionHour: 9 }),
      makeIssue({
        status: 'Failed Preparation',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
      makeIssue({ status: 'Preparation', isClosed: true }),
      makeIssue({ status: 'Failed Preparation', assignees: ['someone-else'] }),
    ];

    expect(
      usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      }),
    ).toEqual({
      todo: 0,
      qc: 0,
      fail: 1,
      pr: 1,
      ws: 0,
      dep: 0,
      blocker: 0,
      humanPendingRed: 0,
      humanPendingYellow: 0,
      consoleTodoByHumanCount: 0,
      consoleAwaitingOwnerCount: 0,
    });
  });

  it('counts consoleTodoByHumanCount for a legacy Todo-status issue while todo stays 0', () => {
    const issues = [makeIssue({ status: 'Todo' })];

    const result = usecase.run({
      issues,
      assigneeLogin: ASSIGNEE,
      storyColorMap: new Map(),
    });

    expect(result.todo).toBe(0);
    expect(result.consoleTodoByHumanCount).toBe(1);
  });

  it.each([
    {
      scenario:
        'an issue with nextActionDate set, which qc excludes via the actionable predicate',
      issueOverrides: {
        status: 'Awaiting Owner',
        nextActionDate: new Date('2026-07-01T00:00:00.000Z'),
      },
    },
    {
      scenario:
        'an issue with nextActionHour set, which qc excludes via the actionable predicate',
      issueOverrides: { status: 'Awaiting Owner', nextActionHour: 10 },
    },
    {
      scenario:
        'an issue with a differently-cased Awaiting Owner status, which qc excludes via exact-case matching',
      issueOverrides: { status: 'awaiting owner' },
    },
  ])(
    'counts consoleAwaitingOwnerCount for $scenario while qc stays 0',
    ({ issueOverrides }) => {
      const issues = [makeIssue(issueOverrides)];

      const result = usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      });

      expect(result.qc).toBe(0);
      expect(result.consoleAwaitingOwnerCount).toBe(1);
    },
  );

  it('excludes an In Tmux by human status issue from both new actionable count fields', () => {
    const issues = [makeIssue({ status: 'In Tmux by human' })];

    const result = usecase.run({
      issues,
      assigneeLogin: ASSIGNEE,
      storyColorMap: new Map(),
    });

    expect(result.consoleTodoByHumanCount).toBe(0);
    expect(result.consoleAwaitingOwnerCount).toBe(0);
  });

  it('counts dep as Awaiting Workspace issues blocked by a dependency, and never as ws', () => {
    const issues = [
      makeIssue({ status: 'Awaiting Workspace' }),
      makeIssue({
        status: 'Awaiting Workspace',
        dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
      }),
    ];

    expect(
      usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap: new Map(),
      }),
    ).toMatchObject({
      ws: 1,
      dep: 1,
    });
  });

  it('counts blocker by case-insensitive workflow blocker story membership for non-closed mine issues', () => {
    const issues = [
      makeIssue({
        status: 'Awaiting Workspace',
        story: 'Workflow Blocker / urgent',
      }),
      makeIssue({ status: 'Awaiting Workspace', story: 'workflow blocker' }),
      makeIssue({
        status: 'Awaiting Workspace',
        story: 'regular / maintenance',
      }),
      makeIssue({
        status: 'Awaiting Workspace',
        story: 'workflow blocker',
        isClosed: true,
      }),
      makeIssue({
        status: 'Awaiting Workspace',
        story: 'workflow blocker',
        assignees: ['someone-else'],
      }),
    ];

    expect(
      usecase.run({ issues, assigneeLogin: ASSIGNEE, storyColorMap: new Map() })
        .blocker,
    ).toBe(2);
  });

  it('counts open AQC and TodoByHuman issues by story color across all assignees', () => {
    const storyColorMap = new Map([
      ['opt-red-story', 'RED'],
      ['opt-yellow-story', 'YELLOW'],
      ['opt-blue-story', 'BLUE'],
      ['opt-green-story', 'GREEN'],
      ['red-story', 'RED'],
      ['yellow-story', 'YELLOW'],
      ['blue-story', 'BLUE'],
      ['green-story', 'GREEN'],
    ]);
    const issues = [
      makeIssue({
        status: 'Awaiting Owner',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
      }),
      makeIssue({
        status: 'Todo by human',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
      }),
      makeIssue({
        status: 'Awaiting Owner',
        story: 'yellow-story',
        storyOptionId: 'opt-yellow-story',
      }),
      makeIssue({
        status: 'Awaiting Owner',
        story: 'blue-story',
        storyOptionId: 'opt-blue-story',
        assignees: ['someone-else'],
      }),
      makeIssue({
        status: 'Awaiting Owner',
        story: 'green-story',
        storyOptionId: 'opt-green-story',
      }),
      makeIssue({
        status: 'Preparation',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
      }),
      makeIssue({
        status: 'Awaiting Owner',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
        isClosed: true,
      }),
    ];

    const result = usecase.run({
      issues,
      assigneeLogin: ASSIGNEE,
      storyColorMap,
    });
    expect(result.humanPendingRed).toBe(2);
    expect(result.humanPendingYellow).toBe(1);
  });

  it('returns zero for story color counts when story color map is empty', () => {
    const issues = [
      makeIssue({
        status: 'Awaiting Owner',
        story: 'some-story',
        storyOptionId: 'opt-some-story',
      }),
      makeIssue({
        status: 'Todo by human',
        story: 'other-story',
        storyOptionId: 'opt-other-story',
      }),
    ];

    const result = usecase.run({
      issues,
      assigneeLogin: ASSIGNEE,
      storyColorMap: new Map(),
    });
    expect(result.humanPendingRed).toBe(0);
    expect(result.humanPendingYellow).toBe(0);
  });

  it('excludes closed issues from story color counts', () => {
    const storyColorMap = new Map([
      ['opt-red-story', 'RED'],
      ['red-story', 'RED'],
    ]);
    const issues = [
      makeIssue({
        status: 'Awaiting Owner',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
        isClosed: true,
      }),
    ];

    expect(
      usecase.run({ issues, assigneeLogin: ASSIGNEE, storyColorMap })
        .humanPendingRed,
    ).toBe(0);
  });

  it('counts story color pending regardless of issue assignee', () => {
    const storyColorMap = new Map([
      ['opt-red-story', 'RED'],
      ['red-story', 'RED'],
    ]);
    const issues = [
      makeIssue({
        status: 'Awaiting Owner',
        story: 'red-story',
        storyOptionId: 'opt-red-story',
        assignees: ['other-user'],
      }),
    ];

    expect(
      usecase.run({ issues, assigneeLogin: ASSIGNEE, storyColorMap })
        .humanPendingRed,
    ).toBe(1);
  });

  describe('human pending story color lookup by story option id', () => {
    const storyColorMapKeyedByOptionIdAndName = new Map([
      ['opt-red-story', 'RED'],
      ['opt-yellow-story', 'YELLOW'],
      ['opt-blue-story', 'BLUE'],
      ['Red Story', 'RED'],
      ['Yellow Story', 'YELLOW'],
      ['Blue Story', 'BLUE'],
    ]);

    it('counts pending issues of uniquely named stories under the color of their story', () => {
      const issues = [
        makeIssue({
          status: 'Awaiting Owner',
          story: 'Red Story',
          storyOptionId: 'opt-red-story',
        }),
        makeIssue({
          status: 'Todo by human',
          story: 'Red Story',
          storyOptionId: 'opt-red-story',
        }),
        makeIssue({
          status: 'Awaiting Owner',
          story: 'Yellow Story',
          storyOptionId: 'opt-yellow-story',
        }),
        makeIssue({
          status: 'Todo by human',
          story: 'Blue Story',
          storyOptionId: 'opt-blue-story',
          assignees: ['someone-else'],
        }),
        makeIssue({
          status: 'Preparation',
          story: 'Blue Story',
          storyOptionId: 'opt-blue-story',
        }),
      ];

      expect(
        usecase.run({
          issues,
          assigneeLogin: ASSIGNEE,
          storyColorMap: storyColorMapKeyedByOptionIdAndName,
        }),
      ).toMatchObject({
        humanPendingRed: 2,
        humanPendingYellow: 1,
      });
    });

    it('counts pending issues of two same-named stories under the color of the option each issue references', () => {
      const storyColorMapKeyedByOptionId = new Map([
        ['opt-duplicate-red', 'RED'],
        ['opt-duplicate-blue', 'BLUE'],
      ]);
      const issues = [
        makeIssue({
          status: 'Awaiting Owner',
          story: 'Duplicate Story',
          storyOptionId: 'opt-duplicate-red',
        }),
        makeIssue({
          status: 'Awaiting Owner',
          story: 'Duplicate Story',
          storyOptionId: 'opt-duplicate-blue',
        }),
        makeIssue({
          status: 'Todo by human',
          story: 'Duplicate Story',
          storyOptionId: 'opt-duplicate-blue',
        }),
      ];

      expect(
        usecase.run({
          issues,
          assigneeLogin: ASSIGNEE,
          storyColorMap: storyColorMapKeyedByOptionId,
        }),
      ).toMatchObject({
        humanPendingRed: 1,
        humanPendingYellow: 0,
      });
    });

    it.each([
      { storyOptionIdDescription: 'null', storyOptionId: null },
      { storyOptionIdDescription: 'undefined', storyOptionId: undefined },
    ])(
      'never counts a pending issue whose story option id is $storyOptionIdDescription even when its story name has a color',
      ({ storyOptionId }) => {
        const issues = [
          makeIssue({
            status: 'Awaiting Owner',
            story: 'Red Story',
            storyOptionId,
          }),
          makeIssue({
            status: 'Todo by human',
            story: 'Blue Story',
            storyOptionId,
          }),
        ];

        expect(
          usecase.run({
            issues,
            assigneeLogin: ASSIGNEE,
            storyColorMap: storyColorMapKeyedByOptionIdAndName,
          }),
        ).toMatchObject({
          humanPendingRed: 0,
          humanPendingYellow: 0,
        });
      },
    );
  });

  it('pins every DashboardRow count other than the humanPending fields', () => {
    const otherAssignee = 'someone-else';
    const storyColorMap = new Map([
      ['opt-red', 'RED'],
      ['opt-blue', 'BLUE'],
    ]);
    const cases: {
      scenario: string;
      issues: Issue[];
      expected: DashboardRowWithoutHumanPending;
    }[] = [
      {
        scenario: 'empty issue list',
        issues: [],
        expected: zeroCountsWithoutHumanPending,
      },
      {
        scenario: 'mine issues in each status column',
        issues: [
          makeIssue({ status: 'Todo by human' }),
          makeIssue({ status: 'Todo' }),
          makeIssue({ status: 'Awaiting Owner' }),
          makeIssue({ status: 'Awaiting Workspace' }),
          makeIssue({ status: 'Preparation' }),
          makeIssue({ status: 'Failed Preparation' }),
        ],
        expected: {
          ...zeroCountsWithoutHumanPending,
          todo: 1,
          qc: 1,
          fail: 1,
          pr: 1,
          ws: 1,
          consoleTodoByHumanCount: 2,
          consoleAwaitingOwnerCount: 1,
        },
      },
      {
        scenario: 'issues assigned to another login or closed in each status',
        issues: [
          makeIssue({ status: 'Todo by human', assignees: [otherAssignee] }),
          makeIssue({ status: 'Awaiting Owner', assignees: [otherAssignee] }),
          makeIssue({
            status: 'Awaiting Workspace',
            assignees: [otherAssignee],
          }),
          makeIssue({ status: 'Preparation', assignees: [otherAssignee] }),
          makeIssue({
            status: 'Failed Preparation',
            assignees: [otherAssignee],
          }),
          makeIssue({ status: 'Todo by human', isClosed: true }),
          makeIssue({ status: 'Awaiting Owner', isClosed: true }),
          makeIssue({ status: 'Awaiting Workspace', isClosed: true }),
          makeIssue({ status: 'Preparation', isClosed: true }),
        ],
        expected: zeroCountsWithoutHumanPending,
      },
      {
        scenario: 'Done and In Tmux by human issues',
        issues: [
          makeIssue({ status: 'Done' }),
          makeIssue({ status: 'In Tmux by human' }),
        ],
        expected: zeroCountsWithoutHumanPending,
      },
      {
        scenario: 'dependency and next-action triggers on each status column',
        issues: [
          makeIssue({
            status: 'Todo by human',
            dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
          }),
          makeIssue({
            status: 'Awaiting Owner',
            nextActionDate: new Date('2026-07-01T00:00:00.000Z'),
          }),
          makeIssue({ status: 'Awaiting Owner', nextActionHour: 10 }),
          makeIssue({
            status: 'Awaiting Owner',
            dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
          }),
          makeIssue({
            status: 'Awaiting Workspace',
            dependedIssueUrls: ['https://github.com/demo/repo/issues/999'],
          }),
          makeIssue({ status: 'Awaiting Workspace', nextActionHour: 10 }),
          makeIssue({
            status: 'Preparation',
            nextActionDate: new Date('2026-07-01T00:00:00.000Z'),
          }),
        ],
        expected: {
          ...zeroCountsWithoutHumanPending,
          pr: 1,
          dep: 1,
          consoleAwaitingOwnerCount: 2,
        },
      },
      {
        scenario: 'workflow blocker story membership across statuses',
        issues: [
          makeIssue({
            status: 'Awaiting Workspace',
            story: 'Workflow Blocker / urgent',
          }),
          makeIssue({ status: 'Preparation', story: 'workflow blocker' }),
          makeIssue({
            status: 'Todo by human',
            story: 'workflow blocker',
            isClosed: true,
          }),
        ],
        expected: {
          ...zeroCountsWithoutHumanPending,
          ws: 1,
          pr: 1,
          blocker: 2,
        },
      },
      {
        scenario: 'lowercase awaiting owner status',
        issues: [makeIssue({ status: 'awaiting owner' })],
        expected: {
          ...zeroCountsWithoutHumanPending,
          consoleAwaitingOwnerCount: 1,
        },
      },
      {
        scenario:
          'story colour on issues does not change non-humanPending counts',
        issues: [
          makeIssue({ status: 'Todo by human', storyOptionId: 'opt-red' }),
          makeIssue({ status: 'Awaiting Owner', storyOptionId: 'opt-blue' }),
          makeIssue({ status: 'Preparation', storyOptionId: null }),
        ],
        expected: {
          ...zeroCountsWithoutHumanPending,
          todo: 1,
          qc: 1,
          pr: 1,
          consoleTodoByHumanCount: 1,
          consoleAwaitingOwnerCount: 1,
        },
      },
    ];

    for (const { scenario, issues, expected } of cases) {
      const result = usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap,
      });
      expect({ scenario, counts: withoutHumanPending(result) }).toEqual({
        scenario,
        counts: expected,
      });
    }
  });

  it('pins humanPendingRed and humanPendingYellow for cases the new rule leaves unchanged', () => {
    const storyColorMap = new Map([
      ['opt-red', 'RED'],
      ['opt-yellow', 'YELLOW'],
      ['opt-blue', 'BLUE'],
      ['opt-green', 'GREEN'],
    ]);
    const cases: {
      scenario: string;
      issues: Issue[];
      expected: { humanPendingRed: number; humanPendingYellow: number };
    }[] = [
      {
        scenario: 'open red Awaiting Owner issue without triggers',
        issues: [
          makeIssue({ status: 'Awaiting Owner', storyOptionId: 'opt-red' }),
        ],
        expected: { humanPendingRed: 1, humanPendingYellow: 0 },
      },
      {
        scenario: 'open red Todo by human issue without triggers',
        issues: [
          makeIssue({ status: 'Todo by human', storyOptionId: 'opt-red' }),
        ],
        expected: { humanPendingRed: 1, humanPendingYellow: 0 },
      },
      {
        scenario: 'open yellow Awaiting Owner issue without triggers',
        issues: [
          makeIssue({ status: 'Awaiting Owner', storyOptionId: 'opt-yellow' }),
        ],
        expected: { humanPendingRed: 0, humanPendingYellow: 1 },
      },
      {
        scenario: 'open red issue assigned to another login',
        issues: [
          makeIssue({
            status: 'Awaiting Owner',
            storyOptionId: 'opt-red',
            assignees: ['someone-else'],
          }),
        ],
        expected: { humanPendingRed: 1, humanPendingYellow: 0 },
      },
      {
        scenario: 'closed red issue',
        issues: [
          makeIssue({
            status: 'Awaiting Owner',
            storyOptionId: 'opt-red',
            isClosed: true,
          }),
        ],
        expected: { humanPendingRed: 0, humanPendingYellow: 0 },
      },
      {
        scenario: 'red-coloured story name with null storyOptionId',
        issues: [
          makeIssue({
            status: 'Awaiting Owner',
            story: 'Red Story',
            storyOptionId: null,
          }),
        ],
        expected: { humanPendingRed: 0, humanPendingYellow: 0 },
      },
      {
        scenario: 'blue and green issues',
        issues: [
          makeIssue({ status: 'Awaiting Owner', storyOptionId: 'opt-blue' }),
          makeIssue({ status: 'Todo by human', storyOptionId: 'opt-green' }),
        ],
        expected: { humanPendingRed: 0, humanPendingYellow: 0 },
      },
    ];

    for (const { scenario, issues, expected } of cases) {
      const result = usecase.run({
        issues,
        assigneeLogin: ASSIGNEE,
        storyColorMap,
      });
      expect({
        scenario,
        counts: {
          humanPendingRed: result.humanPendingRed,
          humanPendingYellow: result.humanPendingYellow,
        },
      }).toEqual({ scenario, counts: expected });
    }
  });
});
