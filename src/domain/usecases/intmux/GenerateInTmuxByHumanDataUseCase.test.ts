import { Issue } from '../../entities/Issue';
import { FieldOption, Project } from '../../entities/Project';
import { GenerateInTmuxByHumanDataUseCase } from './GenerateInTmuxByHumanDataUseCase';

const ASSIGNEE = 'owner-login';
const CONSOLE_BASE_URL = 'https://console.example.test';
const CONSOLE_TOKEN = 'test-token-value';

const storyOption = (
  id: string,
  name: string,
  color: FieldOption['color'],
): FieldOption => ({ id, name, color, description: '' });

const STORY_OPTIONS: FieldOption[] = [
  storyOption('s1', 'Story Alpha', 'BLUE'),
  storyOption('s2', 'Story Beta', 'GREEN'),
];

const STATUS_OPTIONS: FieldOption[] = [
  storyOption('st-unread', 'Unread', 'ORANGE'),
  storyOption('st-tmux', 'In Tmux by human', 'RED'),
  storyOption('st-done', 'Done', 'PURPLE'),
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

const projectWithoutStory: Project = baseProject(null);

let issueCounter = 0;
const makeIssue = (overrides: Partial<Issue>): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'demo/repo',
    number: issueCounter,
    title: `Issue ${issueCounter}`,
    state: 'OPEN',
    status: 'In Tmux by human',
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

describe('GenerateInTmuxByHumanDataUseCase', () => {
  const usecase = new GenerateInTmuxByHumanDataUseCase();

  beforeEach(() => {
    issueCounter = 0;
  });

  const run = (
    issues: Issue[],
    overrides: {
      project?: Project;
      consoleBaseUrl?: string | null;
      consoleToken?: string | null;
    } = {},
  ) =>
    usecase.run({
      project: overrides.project ?? projectWithStory,
      issues,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      org: 'demo-org',
      repo: 'demo-repo',
      consoleBaseUrl:
        overrides.consoleBaseUrl === undefined
          ? CONSOLE_BASE_URL
          : overrides.consoleBaseUrl,
      consoleToken:
        overrides.consoleToken === undefined
          ? CONSOLE_TOKEN
          : overrides.consoleToken,
    });

  describe('item filter', () => {
    it('keeps In Tmux by human open issues assigned to the assignee login', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })]);
      expect(result.v1).toEqual([
        {
          story: 'Story Alpha',
          urls: ['https://github.com/demo/repo/issues/1'],
        },
      ]);
    });

    it('rejects issues whose status is not In Tmux by human', () => {
      const result = run([makeIssue({ status: 'Unread' })]);
      expect(result.v1).toEqual([]);
    });

    it('rejects closed issues', () => {
      const result = run([makeIssue({ isClosed: true })]);
      expect(result.v1).toEqual([]);
    });

    it('rejects issues not assigned to the assignee login', () => {
      const result = run([makeIssue({ assignees: ['other-person'] })]);
      expect(result.v1).toEqual([]);
    });
  });

  describe('story grouping and ordering', () => {
    it('orders groups by the project story option display order', () => {
      const result = run([
        makeIssue({ story: 'Story Beta' }),
        makeIssue({ story: 'Story Alpha' }),
      ]);
      expect(result.v2.map((group) => group.story)).toEqual([
        'Story Alpha',
        'Story Beta',
      ]);
    });

    it('places stories not present in the story options at the tail ordered by story string', () => {
      const result = run([
        makeIssue({ story: 'zzz unknown' }),
        makeIssue({ story: 'Story Alpha' }),
        makeIssue({ story: 'aaa unknown' }),
      ]);
      expect(result.v2.map((group) => group.story)).toEqual([
        'Story Alpha',
        'aaa unknown',
        'zzz unknown',
      ]);
    });

    it('maps a null story to the empty string group', () => {
      const result = run([makeIssue({ story: null })]);
      expect(result.v1.map((group) => group.story)).toEqual(['']);
    });

    it('keeps input order of issues within a group', () => {
      const result = run([
        makeIssue({ story: 'Story Alpha' }),
        makeIssue({ story: 'Story Alpha' }),
      ]);
      expect(result.v2[0].urls).toEqual([
        {
          url: 'https://github.com/demo/repo/issues/1',
          title: 'Issue 1',
        },
        {
          url: 'https://github.com/demo/repo/issues/2',
          title: 'Issue 2',
        },
      ]);
    });

    it('uses an empty story order when the project has no story field', () => {
      const result = run([makeIssue({ story: 'whatever' })], {
        project: projectWithoutStory,
      });
      expect(result.v2.map((group) => group.story)).toEqual(['whatever']);
    });
  });

  describe('v3 document', () => {
    it('builds version 3 with overviewUrl from the project and a token-free console url', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })]);
      expect(result.v3).toEqual({
        version: 3,
        overviewUrl: 'https://github.com/orgs/demo/projects/1',
        tdpmConsoleUrl: 'https://console.example.test/projects/demo/prs',
        groups: result.v2,
      });
    });

    it('is null when the console base url is unset', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })], {
        consoleBaseUrl: null,
      });
      expect(result.v3).toBeNull();
      expect(result.v4).toBeNull();
    });
  });

  describe('v4 document', () => {
    it('builds version 4 with key order version, overviewUrl, tdpmConsoleUrl, newIssueUrl, groups', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })]);
      expect(result.v4).not.toBeNull();
      expect(Object.keys(result.v4 ?? {})).toEqual([
        'version',
        'overviewUrl',
        'tdpmConsoleUrl',
        'newIssueUrl',
        'groups',
      ]);
    });

    it('embeds the token in the console url and derives the new issue url from org and repo', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })]);
      expect(result.v4).toEqual({
        version: 4,
        overviewUrl: 'https://github.com/orgs/demo/projects/1',
        tdpmConsoleUrl:
          'https://console.example.test/projects/demo/prs?k=test-token-value',
        newIssueUrl:
          'https://github.com/demo-org/demo-repo/issues/new?assignees=owner-login',
        groups: [
          {
            story: 'Story Alpha',
            sessions: [
              {
                name: 'https://github.com/demo/repo/issues/1',
                description: 'Issue 1',
              },
            ],
          },
        ],
      });
    });

    it('maps each session to the issue url as name and the issue title as description', () => {
      const result = run([
        makeIssue({ story: 'Story Alpha' }),
        makeIssue({ story: 'Story Alpha' }),
      ]);
      expect(result.v4?.groups).toEqual([
        {
          story: 'Story Alpha',
          sessions: [
            {
              name: 'https://github.com/demo/repo/issues/1',
              description: 'Issue 1',
            },
            {
              name: 'https://github.com/demo/repo/issues/2',
              description: 'Issue 2',
            },
          ],
        },
      ]);
    });

    it('is null when the console token is unset while v3 is still produced', () => {
      const result = run([makeIssue({ story: 'Story Alpha' })], {
        consoleToken: null,
      });
      expect(result.v4).toBeNull();
      expect(result.v3).not.toBeNull();
    });
  });
});
