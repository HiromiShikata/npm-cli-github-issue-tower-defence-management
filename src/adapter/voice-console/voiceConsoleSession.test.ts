import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type {
  IssueComment,
  IssueRepository,
} from '../../domain/usecases/adapter-interfaces/IssueRepository';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
} from '../../domain/usecases/console/GenerateConsoleListsUseCase';
import {
  VoiceConsoleSession,
  type VoiceConsoleSessionDeps,
} from './voiceConsoleSession';

type OperationResponse = { statusCode: number; body: unknown };
type Call = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

const ISSUE7 = 'https://github.com/HiromiShikata/example/issues/7';
const ISSUE8 = 'https://github.com/HiromiShikata/example/issues/8';
const ISSUE21 = 'https://github.com/HiromiShikata/xcare-example/issues/21';
const PR9 = 'https://github.com/HiromiShikata/example/pull/9';
const PR5 = 'https://github.com/HiromiShikata/other/pull/5';
const ISSUE50 = 'https://github.com/HiromiShikata/example/issues/50';
const DEPENDED3 = 'https://github.com/HiromiShikata/example/issues/3';

const LONG_BODY_7 = `${'x'.repeat(3400)}END-MARKER`;

const ROBOT_COMMENT_7 = [
  'From: :robot: developer (model-b)',
  '## 概要',
  '処理を進めました。',
  '種別: 判断',
  '判断が必要な点は次の通りです。',
  '- 判断A: 既存の列を残す',
  '- 25%案: 一部だけ反映する',
  '- 50%案: 全件反映する',
  '- 回答: 番号で返信してください',
  '次の行は要約に含まれません',
  '## 詳細',
  '本文',
].join('\n');

const SUMMARY_7 = [
  '種別: 判断',
  '判断が必要な点は次の通りです。',
  '- 判断A: 既存の列を残す',
  '- 25%案: 一部だけ反映する',
  '- 50%案: 全件反映する',
  '- 回答: 番号で返信してください',
].join('\n');

const LONG_SUMMARY_8 = `種別: 進捗\n${'あ'.repeat(3500)}\n- 回答: 終わり`;

const ROBOT_COMMENT_8 = `From: :robot: developer (model-f)\n${LONG_SUMMARY_8}`;

const commentsByUrl = new Map<string, IssueComment[]>([
  [
    ISSUE7,
    [
      {
        id: 1,
        author: 'github-actions',
        body: ROBOT_COMMENT_7,
        createdAt: new Date('2026-11-21T01:00:00Z'),
      },
      {
        id: 2,
        author: 'HiromiShikata',
        body: 'ok に進めてください',
        createdAt: new Date('2026-11-21T02:00:00Z'),
      },
    ],
  ],
  [
    ISSUE8,
    [
      {
        id: 3,
        author: 'github-actions',
        body: ROBOT_COMMENT_8,
        createdAt: new Date('2026-11-22T01:00:00Z'),
      },
    ],
  ],
  [
    ISSUE50,
    [
      {
        id: 4,
        author: 'alice',
        body: 'first comment',
        createdAt: new Date('2026-11-23T01:00:00Z'),
      },
      {
        id: 5,
        author: 'bob',
        body: 'second comment',
        createdAt: new Date('2026-11-23T02:00:00Z'),
      },
    ],
  ],
]);

const bodiesByUrl = new Map<string, string>([
  [ISSUE7, LONG_BODY_7],
  [ISSUE50, 'short body text'],
]);

const statusOptions: ConsoleFieldOption[] = [
  { id: 'opt_todo', name: 'Todo by human', color: 'GRAY' },
  { id: 'opt_aw', name: 'Awaiting Workspace', color: 'GREEN' },
  { id: 'opt_prep', name: 'Preparation', color: 'BLUE' },
];

const item = (
  overrides: Partial<ConsoleListItem> &
    Pick<ConsoleListItem, 'number' | 'url' | 'projectItemId'>,
): ConsoleListItem => ({
  title: 'item',
  repo: 'example',
  nameWithOwner: 'HiromiShikata/example',
  itemId: `item_${overrides.number}`,
  isPr: false,
  story: 'Story A',
  status: 'Todo by human',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-11-01T00:00:00Z',
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

// Queue in tab-major order: umino #7, umino #8, xcare #21, umino PR #9.
// xcare has no prs list file, so it contributes no prs entries.
const item7 = item({
  number: 7,
  url: ISSUE7,
  projectItemId: 'PVTI_1',
  title: 'Fix login',
  labels: ['bug', 'urgent'],
  dependedIssueUrls: [DEPENDED3],
});
const item8 = item({
  number: 8,
  url: ISSUE8,
  projectItemId: 'PVTI_2',
  title: 'Refactor queue',
  relatedOpenPullRequestUrls: [PR5],
});
const item9 = item({
  number: 9,
  url: PR9,
  projectItemId: 'PVTI_3',
  title: 'Review pull 9',
  isPr: true,
});
const item21 = item({
  number: 21,
  url: ISSUE21,
  projectItemId: 'PVTI_4',
  title: 'xcare task',
  repo: 'xcare-example',
  nameWithOwner: 'HiromiShikata/xcare-example',
  story: 'Story B',
});

const writeListFile = (
  baseDir: string,
  pjcode: string,
  tab: string,
  items: ConsoleListItem[],
): void => {
  const tabDir = path.join(baseDir, pjcode, tab);
  fs.mkdirSync(tabDir, { recursive: true });
  fs.writeFileSync(
    path.join(tabDir, 'list.json'),
    JSON.stringify({ items, statusOptions }),
  );
};

const collectNumbers = (value: unknown): number[] => {
  if (typeof value === 'number') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectNumbers);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(collectNumbers);
  }
  return [];
};

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-console-session-'));
  writeListFile(root, 'umino', 'todo-by-human', [item7, item8]);
  writeListFile(root, 'umino', 'prs', [item9]);
  writeListFile(root, 'xcare', 'todo-by-human', [item21]);
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const defaultRunOperation = (
  _requestPath: string,
  _body: Record<string, unknown>,
): Promise<OperationResponse> => Promise.resolve({ statusCode: 200, body: {} });

const defaultSearchIssues = (_query: string): Promise<unknown[]> =>
  Promise.resolve([]);

const defaultReadRepositoryFile = (
  _owner: string,
  _repo: string,
  _ref: string,
  _path: string,
): Promise<string> => Promise.resolve('FILE BODY');

const openSession = async (
  options: {
    position?: number;
    runOperation?: VoiceConsoleSessionDeps['runOperation'];
    searchIssues?: VoiceConsoleSessionDeps['searchIssues'];
    readRepositoryFile?: VoiceConsoleSessionDeps['readRepositoryFile'];
  } = {},
) => {
  const getIssueOrPullRequestComments = jest.fn((url: string) =>
    Promise.resolve(commentsByUrl.get(url) ?? []),
  );
  const getIssueOrPullRequestBody = jest.fn((url: string) =>
    Promise.resolve(bodiesByUrl.get(url) ?? ''),
  );
  const issueRepository = {
    getIssueOrPullRequestComments,
    getIssueOrPullRequestBody,
  } as unknown as IssueRepository;

  const resolveIssueRepository = jest.fn((_url: string) => issueRepository);
  const searchIssues = jest.fn(options.searchIssues ?? defaultSearchIssues);
  const getAuthenticatedUserLogin = jest.fn(() =>
    Promise.resolve('HiromiShikata'),
  );
  const readRepositoryFile = jest.fn(
    options.readRepositoryFile ?? defaultReadRepositoryFile,
  );
  const runOperation = jest.fn(options.runOperation ?? defaultRunOperation);
  const newActionId = jest.fn(() => 'action-1');
  const logError = jest.fn((_message: string) => undefined);

  const deps: VoiceConsoleSessionDeps = {
    consoleDataOutputDir: root,
    projectPjcodes: ['umino', 'xcare'],
    resolveIssueRepository,
    searchIssues,
    getAuthenticatedUserLogin,
    readRepositoryFile,
    runOperation,
    newActionId,
    logError,
  };
  const session = new VoiceConsoleSession(deps);

  const call: Call = async (name, args = {}) =>
    JSON.parse(await session.callTool(name, JSON.stringify(args)));

  const position = options.position ?? 1;
  if (position !== 1) {
    const jumped = await call('jump_to_task', { position });
    if (jumped.ok !== true) {
      throw new Error(`jump_to_task failed: ${JSON.stringify(jumped)}`);
    }
  }

  return {
    session,
    call,
    resolveIssueRepository,
    searchIssues,
    getAuthenticatedUserLogin,
    readRepositoryFile,
    runOperation,
    logError,
    getIssueOrPullRequestComments,
    getIssueOrPullRequestBody,
  };
};

describe('VoiceConsoleSession queue navigation', () => {
  it('reports the todo-by-human, prs and total counts and the projects in the queue overview', async () => {
    const { call } = await openSession();

    const overview = await call('queue_overview');

    expect(overview.ok).toBe(true);
    expect(collectNumbers(overview)).toEqual(expect.arrayContaining([3, 1, 4]));
    expect(JSON.stringify(overview)).toContain('umino');
    expect(JSON.stringify(overview)).toContain('xcare');
  });

  it('moves the 1-based position through the tab-major queue and reports end and start errors', async () => {
    const { call } = await openSession();
    const steps: {
      name: string;
      tool: string;
      args?: Record<string, unknown>;
      expectUrl?: string;
      expectError?: string;
    }[] = [
      {
        name: 'jump to position 2',
        tool: 'jump_to_task',
        args: { position: 2 },
        expectUrl: ISSUE8,
      },
      {
        name: 'next task is the xcare issue',
        tool: 'next_task',
        expectUrl: ISSUE21,
      },
      {
        name: 'next task is the pull request',
        tool: 'next_task',
        expectUrl: PR9,
      },
      {
        name: 'next task at the last entry is end_of_queue',
        tool: 'next_task',
        expectError: 'end_of_queue',
      },
      {
        name: 'previous task returns to the xcare issue',
        tool: 'previous_task',
        expectUrl: ISSUE21,
      },
      {
        name: 'jump to position 1',
        tool: 'jump_to_task',
        args: { position: 1 },
        expectUrl: ISSUE7,
      },
      {
        name: 'previous task at the first entry is start_of_queue',
        tool: 'previous_task',
        expectError: 'start_of_queue',
      },
      {
        name: 'jump to position 0 is out of range',
        tool: 'jump_to_task',
        args: { position: 0 },
        expectError: 'position_out_of_range',
      },
      {
        name: 'jump to position 5 is out of range',
        tool: 'jump_to_task',
        args: { position: 5 },
        expectError: 'position_out_of_range',
      },
      {
        name: 'jump to position 4 is the pull request',
        tool: 'jump_to_task',
        args: { position: 4 },
        expectUrl: PR9,
      },
    ];

    for (const step of steps) {
      const result = await call(step.tool, step.args);
      if (step.expectError !== undefined) {
        expect({ name: step.name, ok: result.ok, error: result.error }).toEqual(
          {
            name: step.name,
            ok: false,
            error: step.expectError,
          },
        );
      } else {
        expect({
          name: step.name,
          ok: result.ok,
          mentionsUrl: JSON.stringify(result).includes(step.expectUrl ?? ''),
        }).toEqual({ name: step.name, ok: true, mentionsUrl: true });
      }
    }
  });
});

describe('VoiceConsoleSession reading tools', () => {
  it('returns the latest report summary of the current item from its repository comments', async () => {
    const { call, resolveIssueRepository, getIssueOrPullRequestComments } =
      await openSession();

    const result = await call('current_task_summary');

    expect(result.ok).toBe(true);
    expect(result.text).toBe(SUMMARY_7);
    expect(result.pageCount).toBe(1);
    expect(resolveIssueRepository).toHaveBeenCalledWith(ISSUE7);
    expect(getIssueOrPullRequestComments.mock.calls.map((c) => c[0])).toEqual([
      ISSUE7,
    ]);
  });

  it('pages a long summary and reports page_out_of_range past the last page', async () => {
    const { call } = await openSession({ position: 2 });

    const first = await call('current_task_summary', { page: 1 });
    const second = await call('current_task_summary', { page: 2 });
    const beyond = await call('current_task_summary', { page: 3 });

    expect(first.ok).toBe(true);
    expect(first.pageCount).toBe(2);
    expect(String(first.text).length).toBe(3000);
    expect(second.ok).toBe(true);
    expect(String(first.text) + String(second.text)).toBe(LONG_SUMMARY_8);
    expect({ ok: beyond.ok, error: beyond.error }).toEqual({
      ok: false,
      error: 'page_out_of_range',
    });
  });

  it('renders the title, status, story, labels, dependencies, body and all comments of the current item and pages them', async () => {
    const { call } = await openSession();

    const first = await call('current_task_detail', { page: 1 });
    const second = await call('current_task_detail', { page: 2 });
    const fullText = String(first.text) + String(second.text);

    expect(first.ok).toBe(true);
    expect(first.pageCount).toBe(2);
    expect(String(first.text).length).toBe(3000);
    expect(String(first.text)).not.toContain('END-MARKER');
    expect(String(second.text)).toContain('END-MARKER');
    expect(second.page).toBe(2);
    for (const expectedText of [
      'Fix login',
      'Todo by human',
      'Story A',
      'bug',
      'urgent',
      DEPENDED3,
      'github-actions',
      '2026-11-21T01:00:00.000Z',
      'HiromiShikata',
      '2026-11-21T02:00:00.000Z',
      'ok に進めてください',
    ]) {
      expect({ expectedText, found: fullText.includes(expectedText) }).toEqual({
        expectedText,
        found: true,
      });
    }
  });

  it('returns the body and all comments of a GitHub issue URL', async () => {
    const { call, resolveIssueRepository } = await openSession();

    const result = await call('read_github_url', { url: ISSUE50 });

    expect(result.ok).toBe(true);
    expect(resolveIssueRepository).toHaveBeenCalledWith(ISSUE50);
    const text = JSON.stringify(result);
    for (const expectedText of [
      'short body text',
      'alice',
      'first comment',
      'bob',
      'second comment',
    ]) {
      expect({ expectedText, found: text.includes(expectedText) }).toEqual({
        expectedText,
        found: true,
      });
    }
  });

  it('gives invalid_url for a URL that is not a GitHub issue or pull request URL', async () => {
    const cases = [
      { url: 'https://example.com/HiromiShikata/example/issues/50' },
      { url: 'not a url' },
    ];

    for (const testCase of cases) {
      const { call } = await openSession();

      const result = await call('read_github_url', { url: testCase.url });

      expect({ url: testCase.url, ok: result.ok, error: result.error }).toEqual(
        {
          url: testCase.url,
          ok: false,
          error: 'invalid_url',
        },
      );
    }
  });

  it('reads a blob URL through the repository file reader and returns the text', async () => {
    const { call, readRepositoryFile } = await openSession();

    const result = await call('read_repository_file', {
      url: 'https://github.com/HiromiShikata/example/blob/main/docs/a.md',
    });

    expect(readRepositoryFile.mock.calls).toEqual([
      ['HiromiShikata', 'example', 'main', 'docs/a.md'],
    ]);
    expect(result.ok).toBe(true);
    expect(result.text).toBe('FILE BODY');
  });

  it('pages a long repository file', async () => {
    const { call } = await openSession({
      readRepositoryFile: () => Promise.resolve('あ'.repeat(3001)),
    });

    const second = await call('read_repository_file', {
      url: 'https://github.com/HiromiShikata/example/blob/main/docs/a.md',
      page: 2,
    });

    expect(second.ok).toBe(true);
    expect(second.text).toBe('あ');
  });

  it('gives invalid_url for a URL that is not a blob URL and reads nothing', async () => {
    const cases = [
      { url: 'https://github.com/HiromiShikata/example/tree/main/docs' },
      { url: 'https://github.com/HiromiShikata/example/issues/1' },
      { url: 'https://example.com/HiromiShikata/example/blob/main/a.md' },
    ];

    for (const testCase of cases) {
      const { call, readRepositoryFile } = await openSession();

      const result = await call('read_repository_file', { url: testCase.url });

      expect({ url: testCase.url, ok: result.ok, error: result.error }).toEqual(
        {
          url: testCase.url,
          ok: false,
          error: 'invalid_url',
        },
      );
      expect(readRepositoryFile).not.toHaveBeenCalled();
    }
  });

  it('prefixes a query without a user, org or repo qualifier with the authenticated login', async () => {
    const cases = [
      { query: 'label:bug', expected: 'user:HiromiShikata label:bug' },
      {
        query: 'repo:HiromiShikata/example label:bug',
        expected: 'repo:HiromiShikata/example label:bug',
      },
      { query: 'org:acme is:open', expected: 'org:acme is:open' },
      { query: 'user:someone is:open', expected: 'user:someone is:open' },
    ];

    for (const testCase of cases) {
      const { call, searchIssues } = await openSession();

      const result = await call('search_issues', { query: testCase.query });

      expect({
        query: testCase.query,
        ok: result.ok,
        searched: searchIssues.mock.calls.map((c) => c[0]),
      }).toEqual({
        query: testCase.query,
        ok: true,
        searched: [testCase.expected],
      });
    }
  });
});

describe('VoiceConsoleSession write tools', () => {
  const snoozeRows = [
    { preset: '1h', action: 'snooze_1hour' },
    { preset: '3h', action: 'snooze_3hours' },
    { preset: '6h', action: 'snooze_6hours' },
    { preset: '1d', action: 'snooze_1day' },
    { preset: '2d', action: 'snooze_2days' },
    { preset: '3d', action: 'snooze_3days' },
    { preset: '5d', action: 'snooze_5days' },
    { preset: '1w', action: 'snooze_1week' },
    { preset: '1month', action: 'snooze_1month' },
  ];

  const triageBase = {
    pjcode: 'umino',
    issueUrl: ISSUE7,
    projectItemId: 'PVTI_1',
    expectedStatusName: 'Todo by human',
  };

  const rows = [
    {
      name: 'prepare_ok sets Awaiting Workspace with comment ok',
      position: 1,
      tool: 'prepare_ok',
      args: {},
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: 'set_status',
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
        expectedStatusName: 'Todo by human',
        statusName: 'Awaiting Workspace',
        commentBody: 'ok',
        setStatusWhenCommentFails: true,
      },
    },
    {
      name: 'prepare_comment_and_move_to_awaiting_workspace posts the text and moves the status',
      position: 1,
      tool: 'prepare_comment_and_move_to_awaiting_workspace',
      args: { comment_text: 'X' },
      requestPath: '/api/triage',
      body: {
        ...triageBase,
        action: 'set_status',
        statusName: 'Awaiting Workspace',
        commentBody: 'X',
      },
    },
    {
      name: 'prepare_comment_only posts a comment and keeps the status',
      position: 1,
      tool: 'prepare_comment_only',
      args: { comment_text: 'X' },
      requestPath: '/api/comment',
      body: { pjcode: 'umino', url: ISSUE7, body: 'X' },
    },
    {
      name: 'prepare_close with reason completed and no comment',
      position: 1,
      tool: 'prepare_close',
      args: { reason: 'completed', comment_kind: 'none' },
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: 'close',
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
      },
    },
    {
      name: 'prepare_close with reason not_planned uses close_not_planned',
      position: 1,
      tool: 'prepare_close',
      args: { reason: 'not_planned', comment_kind: 'none' },
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: 'close_not_planned',
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
      },
    },
    {
      name: 'prepare_close with comment_kind ok adds commentBody ok',
      position: 1,
      tool: 'prepare_close',
      args: { reason: 'completed', comment_kind: 'ok' },
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: 'close',
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
        commentBody: 'ok',
      },
    },
    {
      name: 'prepare_close with comment_kind text adds the comment text',
      position: 1,
      tool: 'prepare_close',
      args: { reason: 'completed', comment_kind: 'text', comment_text: 'Y' },
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: 'close',
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
        commentBody: 'Y',
      },
    },
    ...snoozeRows.map((row) => ({
      name: `prepare_snooze preset ${row.preset} gives ${row.action}`,
      position: 1,
      tool: 'prepare_snooze',
      args: { preset: row.preset },
      requestPath: '/api/triage',
      body: {
        pjcode: 'umino',
        action: row.action,
        issueUrl: ISSUE7,
        projectItemId: 'PVTI_1',
      },
    })),
    {
      name: 'prepare_set_status moves the item to Preparation',
      position: 1,
      tool: 'prepare_set_status',
      args: { status_name: 'Preparation' },
      requestPath: '/api/triage',
      body: { ...triageBase, action: 'set_status', statusName: 'Preparation' },
    },
    {
      name: 'prepare_move_to_in_tmux_by_human uses set_intmux',
      position: 1,
      tool: 'prepare_move_to_in_tmux_by_human',
      args: {},
      requestPath: '/api/intmux',
      body: { ...triageBase, action: 'set_intmux' },
    },
    {
      name: 'prepare_pull_request_review approve_and_merge for a pull request item',
      position: 4,
      tool: 'prepare_pull_request_review',
      args: { action: 'approve_and_merge' },
      requestPath: '/api/review',
      body: {
        pjcode: 'umino',
        action: 'approve_and_merge',
        prUrl: PR9,
        projectItemId: 'PVTI_3',
        expectedStatusName: 'Todo by human',
      },
    },
    {
      name: 'prepare_pull_request_review request_changes carries the comment',
      position: 4,
      tool: 'prepare_pull_request_review',
      args: { action: 'request_changes', comment_text: 'Z' },
      requestPath: '/api/review',
      body: {
        pjcode: 'umino',
        action: 'request_changes',
        prUrl: PR9,
        projectItemId: 'PVTI_3',
        commentBody: 'Z',
        expectedStatusName: 'Todo by human',
      },
    },
    {
      name: 'prepare_pull_request_review unnecessary closes the pull request with its messages',
      position: 4,
      tool: 'prepare_pull_request_review',
      args: { action: 'unnecessary' },
      requestPath: '/api/review',
      body: {
        pjcode: 'umino',
        action: 'unnecessary',
        prUrl: PR9,
        projectItemId: 'PVTI_3',
        issueUrl: PR9,
        commentBody: 'This pull request is unnecessary.',
        issueCommentBody: `The pull request for this issue was unnecessary and has been closed: ${PR9}\n\nDo not create it again.`,
        expectedStatusName: 'Todo by human',
      },
    },
    {
      name: 'prepare_pull_request_review totally_wrong closes the pull request with its message',
      position: 4,
      tool: 'prepare_pull_request_review',
      args: { action: 'totally_wrong' },
      requestPath: '/api/review',
      body: {
        pjcode: 'umino',
        action: 'close',
        prUrl: PR9,
        issueUrl: PR9,
        projectItemId: 'PVTI_3',
        commentBody: 'totally wrong',
        expectedStatusName: 'Todo by human',
      },
    },
    {
      name: 'prepare_pull_request_review uses the related open pull request of an issue',
      position: 2,
      tool: 'prepare_pull_request_review',
      args: { action: 'approve_and_merge' },
      requestPath: '/api/review',
      body: {
        pjcode: 'umino',
        action: 'approve_and_merge',
        prUrl: PR5,
        projectItemId: 'PVTI_2',
        expectedStatusName: 'Todo by human',
      },
    },
  ];

  it('prepares without running the operation and runs it once with the request shape on confirm', async () => {
    for (const row of rows) {
      const { call, runOperation, newActionId } = await openSession({
        position: row.position,
      });

      const prepared = await call(row.tool, row.args);

      expect({
        name: row.name,
        ok: prepared.ok,
        actionId: prepared.actionId,
      }).toEqual({
        name: row.name,
        ok: true,
        actionId: 'action-1',
      });
      expect(typeof prepared.readBack).toBe('string');
      expect(String(prepared.readBack).length).toBeGreaterThan(0);
      expect({ name: row.name, calls: runOperation.mock.calls.length }).toEqual(
        {
          name: row.name,
          calls: 0,
        },
      );

      const confirmed = await call('confirm_pending_action', {
        action_id: 'action-1',
        owner_reply: 'はい',
      });

      expect({ name: row.name, ok: confirmed.ok }).toEqual({
        name: row.name,
        ok: true,
      });
      expect({
        name: row.name,
        operations: runOperation.mock.calls,
      }).toEqual({
        name: row.name,
        operations: [[row.requestPath, { ...row.body, actionId: 'action-1' }]],
      });
      expect(newActionId).toHaveBeenCalled();
    }
  });

  it('gives an error without running the operation for invalid write requests', async () => {
    const cases = [
      {
        name: 'pull request review on an issue with no related pull request',
        position: 1,
        tool: 'prepare_pull_request_review',
        args: { action: 'approve_and_merge' },
        error: 'pull_request_url_required',
      },
      {
        name: 'status name that is not an option of the item',
        position: 1,
        tool: 'prepare_set_status',
        args: { status_name: 'Nope' },
        error: 'unknown_status',
      },
      {
        name: 'comment kind text without comment text',
        position: 1,
        tool: 'prepare_close',
        args: { reason: 'completed', comment_kind: 'text' },
        error: 'comment_text_required',
      },
    ];

    for (const testCase of cases) {
      const { call, runOperation } = await openSession({
        position: testCase.position,
      });

      const result = await call(testCase.tool, testCase.args);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: false,
        error: testCase.error,
      });
      expect({
        name: testCase.name,
        calls: runOperation.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        calls: 0,
      });
    }
  });

  it('keeps the pending action when a later prepare fails validation', async () => {
    const { call, runOperation } = await openSession();

    await call('prepare_ok');
    const failed = await call('prepare_close', {
      reason: 'completed',
      comment_kind: 'text',
    });
    expect({ ok: failed.ok, error: failed.error }).toEqual({
      ok: false,
      error: 'comment_text_required',
    });

    const confirmed = await call('confirm_pending_action', {
      action_id: 'action-1',
      owner_reply: 'はい',
    });

    expect(confirmed.ok).toBe(true);
    expect(runOperation.mock.calls).toEqual([
      [
        '/api/triage',
        {
          pjcode: 'umino',
          action: 'set_status',
          issueUrl: ISSUE7,
          projectItemId: 'PVTI_1',
          expectedStatusName: 'Todo by human',
          statusName: 'Awaiting Workspace',
          commentBody: 'ok',
          setStatusWhenCommentFails: true,
          actionId: 'action-1',
        },
      ],
    ]);
  });
});

describe('VoiceConsoleSession two-phase gate', () => {
  it('refuses to run the operation when there is no matching confirmed pending action', async () => {
    const cases = [
      {
        name: 'nothing prepared',
        prepare: false,
        cancel: false,
        actionId: 'action-1',
        reply: 'はい',
        error: 'no_pending_action',
      },
      {
        name: 'wrong action_id',
        prepare: true,
        cancel: false,
        actionId: 'action-9',
        reply: 'はい',
        error: 'action_id_mismatch',
      },
      {
        name: 'owner reply that is not はい',
        prepare: true,
        cancel: false,
        actionId: 'action-1',
        reply: 'うん',
        error: 'owner_reply_not_yes',
      },
      {
        name: 'confirm after cancel',
        prepare: true,
        cancel: true,
        actionId: 'action-1',
        reply: 'はい',
        error: 'no_pending_action',
      },
    ];

    for (const testCase of cases) {
      const { call, runOperation } = await openSession();
      if (testCase.prepare) {
        await call('prepare_ok');
      }
      if (testCase.cancel) {
        await call('cancel_pending_action');
      }

      const result = await call('confirm_pending_action', {
        action_id: testCase.actionId,
        owner_reply: testCase.reply,
      });

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: false,
        error: testCase.error,
      });
      expect({
        name: testCase.name,
        calls: runOperation.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        calls: 0,
      });
    }
  });

  it('runs the operation only once when confirm is repeated after one successful prepare', async () => {
    const { call, runOperation } = await openSession();

    await call('prepare_ok');
    const first = await call('confirm_pending_action', {
      action_id: 'action-1',
      owner_reply: 'はい',
    });
    const second = await call('confirm_pending_action', {
      action_id: 'action-1',
      owner_reply: 'はい',
    });

    expect(first.ok).toBe(true);
    expect({ ok: second.ok, error: second.error }).toEqual({
      ok: false,
      error: 'no_pending_action',
    });
    expect(runOperation).toHaveBeenCalledTimes(1);
  });
});

describe('VoiceConsoleSession queue removal after confirm', () => {
  it('removes the item from the queue after a removing write and keeps it after a comment only write', async () => {
    const cases = [
      {
        name: 'prepare_ok removes the item',
        tool: 'prepare_ok',
        args: {},
        expectedTotal: 3,
        expectedTitle: 'Refactor queue',
        keepsItem: false,
      },
      {
        name: 'prepare_comment_only keeps the item',
        tool: 'prepare_comment_only',
        args: { comment_text: 'X' },
        expectedTotal: 4,
        expectedTitle: 'Fix login',
        keepsItem: true,
      },
    ];

    for (const testCase of cases) {
      const { call } = await openSession();
      const before = await call('queue_overview');
      expect(collectNumbers(before)).toContain(4);

      await call(testCase.tool, testCase.args);
      const confirmed = await call('confirm_pending_action', {
        action_id: 'action-1',
        owner_reply: 'はい',
      });
      expect({ name: testCase.name, ok: confirmed.ok }).toEqual({
        name: testCase.name,
        ok: true,
      });

      const after = await call('queue_overview');
      const detail = await call('current_task_detail', { page: 1 });

      expect({
        name: testCase.name,
        totalPresent: collectNumbers(after).includes(testCase.expectedTotal),
        currentTitleIsNext: String(detail.text).includes(
          testCase.expectedTitle,
        ),
      }).toEqual({
        name: testCase.name,
        totalPresent: true,
        currentTitleIsNext: true,
      });
    }
  });

  it('keeps the item in the queue when the operation fails with 400 or 502', async () => {
    const cases = [{ statusCode: 400 }, { statusCode: 502 }];

    for (const testCase of cases) {
      const { call } = await openSession({
        runOperation: () =>
          Promise.resolve({
            statusCode: testCase.statusCode,
            body: { error: 'owner_action_rejected' },
          }),
      });
      await call('prepare_ok');

      const confirmed = await call('confirm_pending_action', {
        action_id: 'action-1',
        owner_reply: 'はい',
      });
      const after = await call('queue_overview');
      const detail = await call('current_task_detail', { page: 1 });

      expect({
        statusCode: testCase.statusCode,
        ok: confirmed.ok,
        error: confirmed.error,
        totalStillFour: collectNumbers(after).includes(4),
        stillFirst: String(detail.text).includes('Fix login'),
      }).toEqual({
        statusCode: testCase.statusCode,
        ok: false,
        error: 'owner_action_rejected',
        totalStillFour: true,
        stillFirst: true,
      });
    }
  });
});

describe('VoiceConsoleSession error handling', () => {
  it('gives unknown_tool for a tool name that does not exist', async () => {
    const { call } = await openSession();

    const result = await call('no_such_tool');

    expect({ ok: result.ok, error: result.error }).toEqual({
      ok: false,
      error: 'unknown_tool',
    });
  });

  it('gives invalid_arguments for arguments that are not a JSON object', async () => {
    const cases = [
      { argumentsJson: 'not json' },
      { argumentsJson: '[1]' },
      { argumentsJson: '"text"' },
      { argumentsJson: 'null' },
      { argumentsJson: '42' },
    ];

    for (const testCase of cases) {
      const { session } = await openSession();

      const result: Record<string, unknown> = JSON.parse(
        await session.callTool('queue_overview', testCase.argumentsJson),
      );

      expect({
        argumentsJson: testCase.argumentsJson,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        argumentsJson: testCase.argumentsJson,
        ok: false,
        error: 'invalid_arguments',
      });
    }
  });

  it('gives tool_failed and logs the error when a read tool throws', async () => {
    const { call, logError } = await openSession({
      searchIssues: () => Promise.reject(new Error('search boom')),
    });

    const result = await call('search_issues', { query: 'bug' });

    expect({ ok: result.ok, error: result.error }).toEqual({
      ok: false,
      error: 'tool_failed',
    });
    expect(logError.mock.calls.flat().join('\n')).toContain('search boom');
  });

  it('gives tool_failed and logs the error when the confirmed operation throws', async () => {
    const { call, logError } = await openSession({
      runOperation: () => Promise.reject(new Error('operation boom')),
    });
    await call('prepare_ok');

    const result = await call('confirm_pending_action', {
      action_id: 'action-1',
      owner_reply: 'はい',
    });

    expect({ ok: result.ok, error: result.error }).toEqual({
      ok: false,
      error: 'tool_failed',
    });
    expect(logError.mock.calls.flat().join('\n')).toContain('operation boom');
  });
});
