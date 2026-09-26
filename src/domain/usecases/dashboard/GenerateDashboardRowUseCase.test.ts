import { Issue } from '../../entities/Issue';
import { GenerateDashboardRowUseCase } from './GenerateDashboardRowUseCase';

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
    agent: null,
    stateReason: null,
    ...overrides,
  };
};

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
      humanPendingBlue: 0,
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
      humanPendingBlue: 0,
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
      humanPendingBlue: 0,
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
      humanPendingBlue: 0,
    });
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
    expect(result.humanPendingBlue).toBe(1);
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
    expect(result.humanPendingBlue).toBe(0);
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
        humanPendingBlue: 1,
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
        humanPendingBlue: 2,
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
          humanPendingBlue: 0,
        });
      },
    );
  });
});
