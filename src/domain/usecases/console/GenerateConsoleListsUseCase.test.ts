import { Issue } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
import { GenerateConsoleListsUseCase } from './GenerateConsoleListsUseCase';

const ASSIGNEE = 'owner-login';

const storyOption = (
  id: string,
  name: string,
  color: FieldOption['color'],
): FieldOption => ({ id, name, color, description: '' });

const STORY_OPTIONS: FieldOption[] = [
  storyOption('s1', 'regular / NO STORY; SET STORY FIELD', 'RED'),
  storyOption('s2', 'Story Alpha', 'BLUE'),
  storyOption('s3', 'Story Beta', 'GREEN'),
];

const STATUS_OPTIONS: FieldOption[] = [
  storyOption('st-unread', 'Unread', 'ORANGE'),
  storyOption('st-aw', 'Awaiting Workspace', 'BLUE'),
  storyOption('st-prep', 'Preparation', 'YELLOW'),
  storyOption('st-failed', 'Failed Preparation', 'RED'),
  storyOption('st-aqc', 'Awaiting Quality Check', 'GREEN'),
  storyOption('st-todo', 'Todo by human', 'PINK'),
  storyOption('st-tmux', 'In Tmux live session', 'RED'),
  storyOption('st-tmux-agent', 'In Tmux by agent', 'YELLOW'),
  storyOption('st-done', 'Done', 'PURPLE'),
  storyOption('st-icebox', 'Icebox', 'GRAY'),
];

const baseProject = (story: Project['story']): Project => ({
  id: 'project-node-id',
  url: 'https://github.com/orgs/demo/projects/1',
  databaseId: 1,
  name: 'demo',
  status: {
    name: 'Status',
    fieldId: 'status-field',
    statuses: STATUS_OPTIONS,
  },
  nextActionDate: null,
  nextActionHour: null,
  story,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const projectWithStory: Project = baseProject({
  name: 'story',
  fieldId: 'story-field',
  databaseId: 2,
  stories: STORY_OPTIONS,
  workflowManagementStory: { id: 'wm', name: 'workflow management' },
});

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
    body: 'should never be projected',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date('2026-06-13T08:18:45.000Z'),
    author: 'someone',
    ...overrides,
  };
};

describe('GenerateConsoleListsUseCase', () => {
  const usecase = new GenerateConsoleListsUseCase();
  const generatedAt = '2026-06-14T07:22:33Z';

  beforeEach(() => {
    issueCounter = 0;
  });

  const run = (
    issues: Issue[],
    project: Project = projectWithStory,
    workflowBlockerStoryName: string | null = 'regular / WORKFLOW BLOCKER',
  ) =>
    usecase.run({
      project,
      issues,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      generatedAt,
      workflowBlockerStoryName,
    });

  describe('common actionable filter', () => {
    it('rejects closed issues', () => {
      const result = run([makeIssue({ status: 'Unread', isClosed: true })]);
      expect(result.unread.items).toHaveLength(0);
    });

    it('rejects issues not assigned to the assignee login', () => {
      const result = run([
        makeIssue({ status: 'Unread', assignees: ['other-person'] }),
      ]);
      expect(result.unread.items).toHaveLength(0);
    });

    it('rejects issues with a depended issue url', () => {
      const result = run([
        makeIssue({
          status: 'Unread',
          dependedIssueUrls: ['https://github.com/demo/repo/issues/99'],
        }),
      ]);
      expect(result.unread.items).toHaveLength(0);
    });

    it('rejects issues with a next action date', () => {
      const result = run([
        makeIssue({
          status: 'Unread',
          nextActionDate: new Date('2026-07-01T00:00:00.000Z'),
        }),
      ]);
      expect(result.unread.items).toHaveLength(0);
    });

    it('rejects issues with a next action hour', () => {
      const result = run([makeIssue({ status: 'Unread', nextActionHour: 9 })]);
      expect(result.unread.items).toHaveLength(0);
    });

    it('accepts an issue that passes every actionable condition', () => {
      const result = run([makeIssue({ status: 'Unread' })]);
      expect(result.unread.items).toHaveLength(1);
    });
  });

  describe('per-tab selectors', () => {
    it('selects awaiting quality check items case-insensitively for prs', () => {
      const result = run([
        makeIssue({ status: 'awaiting quality check' }),
        makeIssue({ status: 'Awaiting Quality Check' }),
        makeIssue({ status: 'Unread' }),
      ]);
      expect(result.prs.items).toHaveLength(2);
    });

    it('selects unread items case-insensitively', () => {
      const result = run([
        makeIssue({ status: 'UNREAD' }),
        makeIssue({ status: 'Awaiting Quality Check' }),
      ]);
      expect(result.unread.items).toHaveLength(1);
    });

    it('selects failed preparation items only with exact case', () => {
      const result = run([
        makeIssue({ status: 'Failed Preparation' }),
        makeIssue({ status: 'failed preparation' }),
        makeIssue({ status: 'FAILED PREPARATION' }),
      ]);
      expect(result['failed-preparation'].items).toHaveLength(1);
      expect(result['failed-preparation'].items[0].number).toBe(1);
    });

    it('selects todo-by-human items for the current and legacy status with exact case', () => {
      const result = run([
        makeIssue({ status: 'Todo by human' }),
        makeIssue({ status: 'Todo' }),
        makeIssue({ status: 'todo by human' }),
        makeIssue({ status: 'Unread' }),
      ]);
      expect(result['todo-by-human'].items.map((item) => item.number)).toEqual([
        1, 2,
      ]);
    });

    it('rejects a non-actionable todo-by-human issue', () => {
      const result = run([
        makeIssue({ status: 'Todo by human', nextActionHour: 9 }),
      ]);
      expect(result['todo-by-human'].items).toHaveLength(0);
    });

    it('selects no-story items case-insensitively for triage', () => {
      const result = run([
        makeIssue({ story: 'regular / NO STORY; SET STORY FIELD' }),
        makeIssue({ story: 'no story please' }),
        makeIssue({ story: 'Story Alpha' }),
        makeIssue({ story: null }),
      ]);
      expect(result.triage.items).toHaveLength(2);
    });
  });

  describe('workflow-blocker tab', () => {
    it('selects items whose story matches the configured name case-insensitively', () => {
      const result = run([
        makeIssue({ story: 'regular / WORKFLOW BLOCKER' }),
        makeIssue({ story: 'regular / workflow blocker' }),
        makeIssue({ story: 'Story Alpha' }),
        makeIssue({ story: null }),
      ]);
      expect(result['workflow-blocker'].items).toHaveLength(2);
    });

    it('includes matching items regardless of their status', () => {
      const result = run([
        makeIssue({ story: 'regular / WORKFLOW BLOCKER', status: 'Unread' }),
        makeIssue({
          story: 'regular / WORKFLOW BLOCKER',
          status: 'Awaiting Quality Check',
        }),
        makeIssue({ story: 'regular / WORKFLOW BLOCKER', status: null }),
      ]);
      expect(result['workflow-blocker'].items).toHaveLength(3);
    });

    it('includes matching items that are not actionable', () => {
      const result = run([
        makeIssue({
          story: 'regular / WORKFLOW BLOCKER',
          nextActionDate: new Date('2026-07-01T00:00:00.000Z'),
        }),
        makeIssue({
          story: 'regular / WORKFLOW BLOCKER',
          nextActionHour: 9,
        }),
        makeIssue({
          story: 'regular / WORKFLOW BLOCKER',
          dependedIssueUrls: ['https://github.com/demo/repo/issues/99'],
        }),
      ]);
      expect(result['workflow-blocker'].items).toHaveLength(3);
    });

    it('excludes closed matching items', () => {
      const result = run([
        makeIssue({ story: 'regular / WORKFLOW BLOCKER', isClosed: true }),
        makeIssue({ story: 'regular / WORKFLOW BLOCKER', isClosed: false }),
      ]);
      expect(result['workflow-blocker'].items).toHaveLength(1);
      expect(result['workflow-blocker'].items[0].number).toBe(2);
    });

    it('returns no items when the workflow blocker story name is not configured', () => {
      const result = run(
        [makeIssue({ story: 'regular / WORKFLOW BLOCKER' })],
        projectWithStory,
        null,
      );
      expect(result['workflow-blocker'].items).toHaveLength(0);
    });
  });

  describe('common item projection', () => {
    it('projects the expected keys and never includes a body field', () => {
      const result = run([
        makeIssue({
          status: 'Unread',
          story: 'Story Alpha',
          labels: ['bug', 'p1'],
          isPr: true,
        }),
      ]);
      const item = result.unread.items[0];
      expect(Object.keys(item).sort()).toEqual(
        [
          'createdAt',
          'isPr',
          'itemId',
          'labels',
          'nameWithOwner',
          'number',
          'projectItemId',
          'repo',
          'story',
          'title',
          'url',
        ].sort(),
      );
      expect(item).not.toHaveProperty('body');
      expect(item.repo).toBe('demo/repo');
      expect(item.nameWithOwner).toBe('demo/repo');
      expect(item.projectItemId).toBe(item.itemId);
      expect(item.isPr).toBe(true);
      expect(item.story).toBe('Story Alpha');
      expect(item.labels).toEqual(['bug', 'p1']);
    });

    it('maps a null story to an empty string', () => {
      const result = run([makeIssue({ status: 'Unread', story: null })]);
      expect(result.unread.items[0].story).toBe('');
    });

    it('serializes createdAt as an ISO string keeping milliseconds', () => {
      const result = run([
        makeIssue({
          status: 'Unread',
          createdAt: new Date('2026-06-13T08:18:45.000Z'),
        }),
      ]);
      expect(result.unread.items[0].createdAt).toBe('2026-06-13T08:18:45.000Z');
    });
  });

  describe('story order stable sort', () => {
    it('sorts by story field order and places unknown stories last', () => {
      const result = run([
        makeIssue({ status: 'Unread', story: 'Story Beta' }),
        makeIssue({ status: 'Unread', story: 'Unmapped Story' }),
        makeIssue({ status: 'Unread', story: 'Story Alpha' }),
        makeIssue({ status: 'Unread', story: 'Story Beta' }),
      ]);
      expect(result.unread.items.map((i) => i.story)).toEqual([
        'Story Alpha',
        'Story Beta',
        'Story Beta',
        'Unmapped Story',
      ]);
    });

    it('keeps original order between items sharing the same story (stable)', () => {
      const result = run([
        makeIssue({ status: 'Unread', story: 'Story Alpha', title: 'first' }),
        makeIssue({ status: 'Unread', story: 'Story Alpha', title: 'second' }),
      ]);
      expect(result.unread.items.map((i) => i.title)).toEqual([
        'first',
        'second',
      ]);
    });
  });

  describe('options construction', () => {
    it('excludes awaiting quality check and done from prs status options', () => {
      const names = run([]).prs.statusOptions.map((o) => o.name);
      expect(names).not.toContain('Awaiting Quality Check');
      expect(names).not.toContain('Done');
      expect(names).toContain('Unread');
    });

    it('excludes unread and done from unread status options', () => {
      const names = run([]).unread.statusOptions.map((o) => o.name);
      expect(names).not.toContain('Unread');
      expect(names).not.toContain('Done');
      expect(names).toContain('Awaiting Workspace');
    });

    it('excludes the failed-preparation routing-excluded set', () => {
      const names = run([])['failed-preparation'].statusOptions.map(
        (o) => o.name,
      );
      for (const excluded of [
        'Failed Preparation',
        'Done',
        'Preparation',
        'Icebox',
        'Unread',
        'In Tmux live session',
        'In Tmux by agent',
      ]) {
        expect(names).not.toContain(excluded);
      }
      expect(names).toContain('Awaiting Workspace');
    });

    it('excludes todo by human and done from todo-by-human status options', () => {
      const names = run([])['todo-by-human'].statusOptions.map((o) => o.name);
      expect(names).not.toContain('Todo by human');
      expect(names).not.toContain('Done');
      expect(names).toContain('Awaiting Workspace');
    });

    it('emits all story options for triage and no statusOptions key', () => {
      const triage = run([]).triage;
      expect(triage.storyOptions.map((o) => o.name)).toEqual([
        'regular / NO STORY; SET STORY FIELD',
        'Story Alpha',
        'Story Beta',
      ]);
      expect(triage).not.toHaveProperty('statusOptions');
    });

    it('builds storyOrder from story field option order', () => {
      expect(run([]).prs.storyOrder).toEqual([
        'regular / NO STORY; SET STORY FIELD',
        'Story Alpha',
        'Story Beta',
      ]);
    });
  });

  describe('storyColors shape per tab', () => {
    it('uses object color values for prs, unread and failed-preparation', () => {
      const result = run([]);
      expect(result.prs.storyColors['Story Alpha']).toEqual({ color: 'BLUE' });
      expect(result.unread.storyColors['Story Beta']).toEqual({
        color: 'GREEN',
      });
      expect(result['failed-preparation'].storyColors['Story Alpha']).toEqual({
        color: 'BLUE',
      });
    });

    it('uses plain string color values for triage', () => {
      const result = run([]);
      expect(result.triage.storyColors['Story Alpha']).toBe('BLUE');
      expect(result.triage.storyColors['Story Beta']).toBe('GREEN');
    });
  });

  describe('generatedAt and pjcode passthrough', () => {
    it('writes the provided generatedAt without milliseconds on every tab', () => {
      const result = run([]);
      expect(result.prs.generatedAt).toBe(generatedAt);
      expect(result.triage.generatedAt).toBe(generatedAt);
      expect(result.unread.generatedAt).toBe(generatedAt);
      expect(result['failed-preparation'].generatedAt).toBe(generatedAt);
      expect(generatedAt).not.toMatch(/\.\d{3}Z$/);
    });

    it('writes the configured pjcode on every tab', () => {
      const result = run([]);
      expect(result.prs.pjcode).toBe('demo');
      expect(result.triage.pjcode).toBe('demo');
      expect(result.unread.pjcode).toBe('demo');
      expect(result['failed-preparation'].pjcode).toBe('demo');
    });
  });

  describe('project without a story field', () => {
    const projectNoStory = baseProject(null);

    it('degrades story order, colors and triage options gracefully', () => {
      const result = run(
        [makeIssue({ status: 'Unread', story: 'no story' })],
        projectNoStory,
      );
      expect(result.prs.storyOrder).toEqual([]);
      expect(result.prs.storyColors).toEqual({});
      expect(result.triage.storyOptions).toEqual([]);
      expect(result.triage.storyColors).toEqual({});
      expect(result.unread.items).toHaveLength(1);
      expect(result.triage.items).toHaveLength(1);
    });
  });
});
