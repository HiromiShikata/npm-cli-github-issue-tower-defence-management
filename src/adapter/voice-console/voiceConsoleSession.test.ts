import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { mock } from 'jest-mock-extended';
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

const FIXED_ACTION_ID = 'action-1';

const confirmYes = (call: Call) =>
  call('confirm_pending_action', {
    action_id: FIXED_ACTION_ID,
    owner_reply: 'はい',
  });

type ReadBackStep = { assistant: string } | { owner: string };

const ITEM_TITLE = 'Fix login';

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const parseJsonObject = (text: string): Record<string, unknown> => {
  const value: unknown = JSON.parse(text);
  if (!isJsonObject(value)) {
    throw new Error(`tool result is not a JSON object: ${text}`);
  }
  return value;
};

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

let lastReadBack = '';
const READ_BACK = '<read-back>';
const resolveSpeech = (text: string): string =>
  text === READ_BACK ? lastReadBack : text;

type CreateTaskDefaults = {
  nameWithOwner: string | null;
  storyName: string | null;
};
type CreateTaskDefaultsResolver = (
  pjcode: string,
) => Promise<CreateTaskDefaults>;

const DEFAULT_CREATE_TASK_DEFAULTS: CreateTaskDefaults = {
  nameWithOwner: 'HiromiShikata/example',
  storyName: 'Portal redesign',
};
const defaultResolveCreateTaskDefaults: CreateTaskDefaultsResolver = (
  _pjcode: string,
) => Promise.resolve(DEFAULT_CREATE_TASK_DEFAULTS);

const openSession = async (
  options: {
    position?: number;
    consoleDataOutputDir?: string;
    projectPjcodes?: string[];
    runOperation?: VoiceConsoleSessionDeps['runOperation'];
    searchIssues?: VoiceConsoleSessionDeps['searchIssues'];
    readRepositoryFile?: VoiceConsoleSessionDeps['readRepositoryFile'];
    resolveCreateTaskDefaults?: CreateTaskDefaultsResolver;
  } = {},
) => {
  const getIssueOrPullRequestComments = jest.fn((url: string) =>
    Promise.resolve(commentsByUrl.get(url) ?? []),
  );
  const getIssueOrPullRequestBody = jest.fn((url: string) =>
    Promise.resolve(bodiesByUrl.get(url) ?? ''),
  );
  const issueRepository = mock<IssueRepository>({
    getIssueOrPullRequestComments,
    getIssueOrPullRequestBody,
  });

  const resolveIssueRepository = jest.fn((_url: string) => issueRepository);
  const searchIssues = jest.fn(options.searchIssues ?? defaultSearchIssues);
  const getAuthenticatedUserLogin = jest.fn(() =>
    Promise.resolve('HiromiShikata'),
  );
  const readRepositoryFile = jest.fn(
    options.readRepositoryFile ?? defaultReadRepositoryFile,
  );
  const runOperation = jest.fn(options.runOperation ?? defaultRunOperation);
  const newActionId = jest.fn((): string => FIXED_ACTION_ID);
  const logError = jest.fn((_message: string) => undefined);
  const resolveCreateTaskDefaults = jest.fn(
    options.resolveCreateTaskDefaults ?? defaultResolveCreateTaskDefaults,
  );

  const deps = {
    consoleDataOutputDir: options.consoleDataOutputDir ?? root,
    projectPjcodes: options.projectPjcodes ?? ['umino', 'xcare'],
    resolveIssueRepository,
    searchIssues,
    getAuthenticatedUserLogin,
    readRepositoryFile,
    runOperation,
    newActionId,
    logError,
    resolveCreateTaskDefaults,
  };
  const session = new VoiceConsoleSession(deps);

  const call: Call = async (name, args = {}) => {
    const result = parseJsonObject(
      await session.callTool(name, JSON.stringify(args)),
    );
    if (typeof result.readBack === 'string') {
      lastReadBack = result.readBack;
    }
    return result;
  };

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
    newActionId,
    logError,
    resolveCreateTaskDefaults,
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
    expect(overview).toMatchObject({
      totalCount: 4,
      todoByHumanCount: 3,
      awaitingOwnerCount: 1,
    });
    expect(overview).not.toHaveProperty('prsCount');
    expect(overview.projects).toEqual(
      expect.arrayContaining([
        { pjcode: 'umino', todoByHumanCount: 2, awaitingOwnerCount: 1 },
        { pjcode: 'xcare', todoByHumanCount: 1, awaitingOwnerCount: 0 },
      ]),
    );
  });

  it('labels the tab of each entry in tool results with the owner terms', async () => {
    const { call } = await openSession();

    const todoEntry = await call('jump_to_task', { position: 2 });
    const awaitingOwnerEntry = await call('jump_to_task', { position: 4 });

    expect({
      todo: todoEntry.tab,
      awaitingOwner: awaitingOwnerEntry.tab,
    }).toEqual({ todo: 'Todo by human', awaitingOwner: 'Awaiting Owner' });
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

  it('rejects blob URLs whose path escapes the repository before reading anything', async () => {
    const cases = [
      {
        url: 'https://github.com/HiromiShikata/example/blob/main/../secret.md',
      },
      {
        url: 'https://github.com/HiromiShikata/example/blob/main/a/..%2F..%2Fuser%2Frepos',
      },
      {
        url: 'https://github.com/HiromiShikata/example/blob/main/docs/..%2Fsecret.md',
      },
    ];

    for (const testCase of cases) {
      const { call, readRepositoryFile } = await openSession();

      const result = await call('read_repository_file', { url: testCase.url });

      expect({
        url: testCase.url,
        ok: result.ok,
        error: result.error,
        reads: readRepositoryFile.mock.calls.length,
      }).toEqual({
        url: testCase.url,
        ok: false,
        error: 'invalid_url',
        reads: 0,
      });
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
      const { call, runOperation, newActionId, session } = await openSession({
        position: row.position,
      });

      const prepared = await call(row.tool, row.args);
      session.recordAssistantSpeech(String(prepared.readBack));
      session.recordOwnerSpeech('はい');
      const returnedActionId = FIXED_ACTION_ID;
      expect(newActionId).toHaveBeenCalledTimes(1);

      expect({
        name: row.name,
        ok: prepared.ok,
        actionId: prepared.actionId,
      }).toEqual({
        name: row.name,
        ok: true,
        actionId: returnedActionId,
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
        action_id: returnedActionId,
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
        operations: [
          [row.requestPath, { ...row.body, actionId: returnedActionId }],
        ],
      });
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
    const { call, runOperation, session } = await openSession();

    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
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

describe('VoiceConsoleSession create task tool', () => {
  const CREATE_ISSUE_PATH = '/api/createissue';
  const CREATED_ISSUE_URL =
    'https://github.com/HiromiShikata/example/issues/77';

  const pickCreateBody = (body: Record<string, unknown>) => ({
    title: body.title,
    nameWithOwner: body.nameWithOwner,
    storyName: body.storyName,
    body: body.body,
    actionId: body.actionId,
  });

  const emptyQueueDir = (): string =>
    fs.mkdtempSync(path.join(root, 'empty-queue-'));

  it('prepares without running the operation and runs it once with the create request on confirm', async () => {
    const rows = [
      {
        name: 'title only takes the repository and story defaults',
        args: { title: 'Fix export' },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'HiromiShikata/example',
          storyName: 'Portal redesign',
        },
      },
      {
        name: 'title and body send the body text',
        args: { title: 'Fix export', body: 'Steps to reproduce' },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'HiromiShikata/example',
          storyName: 'Portal redesign',
          body: 'Steps to reproduce',
        },
      },
      {
        name: 'an empty body is not sent',
        args: { title: 'Fix export', body: '' },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'HiromiShikata/example',
          storyName: 'Portal redesign',
        },
      },
      {
        name: 'explicit repository and story replace the defaults',
        args: {
          title: 'Fix export',
          repository: 'acme/portal',
          story: 'Move to Okinawa',
        },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'acme/portal',
          storyName: 'Move to Okinawa',
        },
      },
      {
        name: 'an explicit repository keeps the default story',
        args: { title: 'Fix export', repository: 'acme/portal' },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'acme/portal',
          storyName: 'Portal redesign',
        },
      },
      {
        name: 'an explicit story keeps the default repository',
        args: { title: 'Fix export', story: 'Move to Okinawa' },
        expected: {
          title: 'Fix export',
          nameWithOwner: 'HiromiShikata/example',
          storyName: 'Move to Okinawa',
        },
      },
    ];

    for (const row of rows) {
      const { call, runOperation, session } = await openSession({
        position: 1,
      });

      const prepared = await call('prepare_create_task', row.args);
      const callsBeforeConfirm = runOperation.mock.calls.length;
      session.recordAssistantSpeech(String(prepared.readBack));
      session.recordOwnerSpeech('はい');
      const confirmed = await confirmYes(call);

      expect({
        name: row.name,
        preparedOk: prepared.ok,
        callsBeforeConfirm,
        confirmedOk: confirmed.ok,
        operations: runOperation.mock.calls.map(([requestPath, body]) => [
          requestPath,
          pickCreateBody(body),
        ]),
      }).toEqual({
        name: row.name,
        preparedOk: true,
        callsBeforeConfirm: 0,
        confirmedOk: true,
        operations: [
          [CREATE_ISSUE_PATH, { ...row.expected, actionId: FIXED_ACTION_ID }],
        ],
      });
    }
  });

  it('reads back the title, the repository and the story that will be created', async () => {
    const rows = [
      {
        name: 'defaults',
        args: { title: 'Fix export' },
        spoken: ['Fix export', 'HiromiShikata/example', 'Portal redesign'],
      },
      {
        name: 'explicit repository and story',
        args: {
          title: 'Fix export',
          repository: 'acme/portal',
          story: 'Move to Okinawa',
        },
        spoken: ['Fix export', 'acme/portal', 'Move to Okinawa'],
      },
    ];

    for (const row of rows) {
      const { call } = await openSession({ position: 1 });

      const prepared = await call('prepare_create_task', row.args);
      const readBack = String(prepared.readBack);

      expect({
        name: row.name,
        ok: prepared.ok,
        spoken: row.spoken.map((value) => ({
          value,
          included: readBack.includes(value),
        })),
      }).toEqual({
        name: row.name,
        ok: true,
        spoken: row.spoken.map((value) => ({ value, included: true })),
      });
    }
  });

  it('chooses the project and asks the resolver for the defaults of that project', async () => {
    const rows = [
      {
        name: 'omitted project with a current item uses the item project',
        options: { position: 1, projectPjcodes: ['umino', 'xcare'] },
        args: { title: 'Fix export' },
        expectedPjcode: 'umino',
      },
      {
        name: 'explicit project_pjcode wins over the current item',
        options: { position: 1 },
        args: { title: 'Fix export', project_pjcode: 'xcare' },
        expectedPjcode: 'xcare',
      },
      {
        name: 'omitted project with no current item and one project uses that project',
        options: {
          consoleDataOutputDir: emptyQueueDir(),
          projectPjcodes: ['xcare'],
        },
        args: { title: 'Fix export' },
        expectedPjcode: 'xcare',
      },
    ];

    for (const row of rows) {
      const { call, resolveCreateTaskDefaults } = await openSession(
        row.options,
      );

      const prepared = await call('prepare_create_task', row.args);

      expect({
        name: row.name,
        ok: prepared.ok,
        resolvedFor: [
          ...new Set(
            resolveCreateTaskDefaults.mock.calls.map(([pjcode]) => pjcode),
          ),
        ],
      }).toEqual({
        name: row.name,
        ok: true,
        resolvedFor: [row.expectedPjcode],
      });
    }
  });

  it('gives an error without running the operation for invalid create task requests', async () => {
    const cases = [
      {
        name: 'title missing',
        options: {},
        args: {},
        error: 'title_required',
      },
      {
        name: 'title empty',
        options: {},
        args: { title: '' },
        error: 'title_required',
      },
      {
        name: 'project_pjcode not in the project list',
        options: {},
        args: { title: 'Fix export', project_pjcode: 'nope' },
        error: 'unknown_project',
      },
      {
        name: 'no project and no current item with two projects',
        options: {
          consoleDataOutputDir: emptyQueueDir(),
          projectPjcodes: ['umino', 'xcare'],
        },
        args: { title: 'Fix export' },
        error: 'project_required',
      },
      {
        name: 'no project and no current item with no projects',
        options: {
          consoleDataOutputDir: emptyQueueDir(),
          projectPjcodes: [],
        },
        args: { title: 'Fix export' },
        error: 'project_required',
      },
      {
        name: 'no repository default and no repository argument',
        options: {
          resolveCreateTaskDefaults: () =>
            Promise.resolve({
              nameWithOwner: null,
              storyName: 'Portal redesign',
            }),
        },
        args: { title: 'Fix export' },
        error: 'repository_required',
      },
      {
        name: 'no story default and no story argument',
        options: {
          resolveCreateTaskDefaults: () =>
            Promise.resolve({
              nameWithOwner: 'HiromiShikata/example',
              storyName: null,
            }),
        },
        args: { title: 'Fix export' },
        error: 'story_required',
      },
      {
        name: 'unknown argument property',
        options: {},
        args: { title: 'Fix export', unexpected: 'x' },
        error: 'invalid_arguments',
      },
      {
        name: 'title of the wrong type',
        options: {},
        args: { title: 42 },
        error: 'invalid_arguments',
      },
    ];

    for (const testCase of cases) {
      const { call, runOperation } = await openSession(testCase.options);

      const result = await call('prepare_create_task', testCase.args);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
        operationCalls: runOperation.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        ok: false,
        error: testCase.error,
        operationCalls: 0,
      });
    }
  });

  it('keeps a pending create task when a later prepare_create_task fails validation', async () => {
    const { call, runOperation, session } = await openSession();

    await call('prepare_create_task', { title: 'Fix export' });
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
    const failed = await call('prepare_create_task', {});
    expect({ ok: failed.ok, error: failed.error }).toEqual({
      ok: false,
      error: 'title_required',
    });

    const confirmed = await confirmYes(call);

    expect(confirmed.ok).toBe(true);
    expect(
      runOperation.mock.calls.map(([requestPath, body]) => [
        requestPath,
        pickCreateBody(body),
      ]),
    ).toEqual([
      [
        CREATE_ISSUE_PATH,
        {
          title: 'Fix export',
          nameWithOwner: 'HiromiShikata/example',
          storyName: 'Portal redesign',
          actionId: FIXED_ACTION_ID,
        },
      ],
    ]);
  });

  it('discards a pending create task that the owner did not confirm and runs no operation', async () => {
    const { call, runOperation, session } = await openSession();

    const prepared = await call('prepare_create_task', { title: 'Fix export' });
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('いいえ');
    const cancelled = await call('cancel_pending_action');
    const confirmed = await confirmYes(call);

    expect({
      preparedOk: prepared.ok,
      cancelledOk: cancelled.ok,
      confirmedOk: confirmed.ok,
      operationCalls: runOperation.mock.calls.length,
    }).toEqual({
      preparedOk: true,
      cancelledOk: true,
      confirmedOk: false,
      operationCalls: 0,
    });
  });

  it('gives the created issue URL on confirm and keeps the queue entry', async () => {
    const { call, runOperation, session } = await openSession({
      position: 1,
      runOperation: () =>
        Promise.resolve({
          statusCode: 200,
          body: { ok: true, issueUrl: CREATED_ISSUE_URL },
        }),
    });

    const prepared = await call('prepare_create_task', { title: 'Fix export' });
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);
    const after = await call('queue_overview');
    const detail = await call('current_task_detail', { page: 1 });

    expect({
      ok: confirmed.ok,
      issueUrl: confirmed.issueUrl,
      hasReadBack: typeof confirmed.readBack === 'string',
      operationCalls: runOperation.mock.calls.length,
      totalStillFour: collectNumbers(after).includes(4),
      stillFirst: String(detail.text).includes('Fix login'),
    }).toEqual({
      ok: true,
      issueUrl: CREATED_ISSUE_URL,
      hasReadBack: true,
      operationCalls: 1,
      totalStillFour: true,
      stillFirst: true,
    });
  });

  it('gives the operation error message on confirm when the operation answers 400', async () => {
    const message = 'story option "Nope" not found in project';
    const { call, session } = await openSession({
      runOperation: () =>
        Promise.resolve({
          statusCode: 400,
          body: { ok: false, error: message },
        }),
    });

    const prepared = await call('prepare_create_task', { title: 'Fix export' });
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);

    expect({
      ok: confirmed.ok,
      error: confirmed.error,
      hasIssueUrl: 'issueUrl' in confirmed,
    }).toEqual({ ok: false, error: message, hasIssueUrl: false });
  });

  it('gives tool_failed and logs the error when the create operation throws', async () => {
    const { call, logError, session } = await openSession({
      runOperation: () => Promise.reject(new Error('create boom')),
    });

    const prepared = await call('prepare_create_task', { title: 'Fix export' });
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);

    expect({ ok: confirmed.ok, error: confirmed.error }).toEqual({
      ok: false,
      error: 'tool_failed',
    });
    expect(logError.mock.calls.flat().join('\n')).toContain('create boom');
  });

  it('gives an existing write tool confirm no issueUrl when its operation body has none', async () => {
    const { call, session } = await openSession();

    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);

    expect({
      ok: confirmed.ok,
      hasIssueUrl: 'issueUrl' in confirmed,
    }).toEqual({ ok: true, hasIssueUrl: false });
  });
});

describe('VoiceConsoleSession repeat navigation', () => {
  it('repeats the current summary from page 1 without moving the queue position', async () => {
    const { call } = await openSession({ position: 2 });

    const repeated = await call('repeat_current_task');
    const detail = await call('current_task_detail', { page: 1 });

    expect({ ok: repeated.ok, text: repeated.text }).toEqual({
      ok: true,
      text: LONG_SUMMARY_8.slice(0, 3000),
    });
    expect(String(detail.text)).toContain('Refactor queue');
  });

  it('gives no_current_task when the queue is empty', async () => {
    const emptyDir = path.join(root, 'empty-queue');
    fs.mkdirSync(emptyDir, { recursive: true });
    const { call } = await openSession({ consoleDataOutputDir: emptyDir });

    const repeated = await call('repeat_current_task');

    expect({ ok: repeated.ok, error: repeated.error }).toEqual({
      ok: false,
      error: 'no_current_task',
    });
  });
});

describe('VoiceConsoleSession close read-back', () => {
  it('speaks the close reason in Japanese instead of the enum word', async () => {
    const cases = [
      { reason: 'completed', japanese: '完了', enumWord: 'completed' },
      { reason: 'not_planned', japanese: '完了せず', enumWord: 'not_planned' },
    ];

    for (const testCase of cases) {
      const { call } = await openSession();

      const prepared = await call('prepare_close', {
        reason: testCase.reason,
        comment_kind: 'none',
      });
      const readBack = String(prepared.readBack);

      expect({
        reason: testCase.reason,
        ok: prepared.ok,
        hasJapanese: readBack.includes(testCase.japanese),
        hasEnumWord: readBack.includes(testCase.enumWord),
      }).toEqual({
        reason: testCase.reason,
        ok: true,
        hasJapanese: true,
        hasEnumWord: false,
      });
    }
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
      const { call, runOperation, session } = await openSession();
      if (testCase.prepare) {
        await call('prepare_ok');
        session.recordAssistantSpeech(lastReadBack);
        session.recordOwnerSpeech('はい');
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
    const { call, runOperation, session } = await openSession();

    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
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
      const { call, session } = await openSession();
      const before = await call('queue_overview');
      expect(collectNumbers(before)).toContain(4);

      await call(testCase.tool, testCase.args);
      session.recordAssistantSpeech(lastReadBack);
      session.recordOwnerSpeech('はい');
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
      const { call, session } = await openSession({
        runOperation: () =>
          Promise.resolve({
            statusCode: testCase.statusCode,
            body: { error: 'owner_action_rejected' },
          }),
      });
      await call('prepare_ok');
      session.recordAssistantSpeech(lastReadBack);
      session.recordOwnerSpeech('はい');

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

      const result = parseJsonObject(
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
    const { call, logError, session } = await openSession({
      runOperation: () => Promise.reject(new Error('operation boom')),
    });
    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');

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

describe('VoiceConsoleSession owner-speech confirmation gate', () => {
  it('refuses a confirm with no owner speech after the prepare and keeps the pending action', async () => {
    const { call, runOperation, session } = await openSession();
    await call('prepare_ok');

    const refused = await confirmYes(call);
    expect({ ok: refused.ok, error: refused.error }).toEqual({
      ok: false,
      error: 'owner_speech_not_heard',
    });
    expect(runOperation).not.toHaveBeenCalled();

    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);
    expect(confirmed.ok).toBe(true);
    expect(runOperation).toHaveBeenCalledTimes(1);
  });

  it('accepts はい spelled across fragments, ignoring whitespace and punctuation', async () => {
    const cases = [
      { name: 'one fragment', fragments: ['はい'] },
      { name: 'split into two fragments', fragments: ['は', 'い'] },
      { name: 'with punctuation in fragments', fragments: ['は、', 'い。'] },
      { name: 'with surrounding and inner spaces', fragments: [' は い '] },
      { name: 'with an empty trailing fragment', fragments: ['はい', ''] },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      session.recordAssistantSpeech(lastReadBack);
      for (const fragment of testCase.fragments) {
        session.recordOwnerSpeech(fragment);
      }

      const confirmed = await confirmYes(call);

      expect({ name: testCase.name, ok: confirmed.ok }).toEqual({
        name: testCase.name,
        ok: true,
      });
    }
  });

  it('refuses speech that does not spell はい and keeps the pending action for a later はい', async () => {
    const cases = [
      { name: 'うん', fragments: ['うん'] },
      { name: 'only い', fragments: ['い'] },
      { name: 'only は', fragments: ['は'] },
      { name: 'english yes', fragments: ['yes'] },
    ];

    for (const testCase of cases) {
      const { call, runOperation, session } = await openSession();
      await call('prepare_ok');
      session.recordAssistantSpeech(lastReadBack);
      for (const fragment of testCase.fragments) {
        session.recordOwnerSpeech(fragment);
      }

      const refused = await confirmYes(call);
      expect({
        name: testCase.name,
        ok: refused.ok,
        error: refused.error,
      }).toEqual({
        name: testCase.name,
        ok: false,
        error: 'owner_speech_not_heard',
      });
      expect({
        name: testCase.name,
        calls: runOperation.mock.calls.length,
      }).toEqual({
        name: testCase.name,
        calls: 0,
      });

      session.recordAssistantSpeech(lastReadBack);
      session.recordOwnerSpeech('はい');
      const confirmed = await confirmYes(call);
      expect({ name: testCase.name, ok: confirmed.ok }).toEqual({
        name: testCase.name,
        ok: true,
      });
    }
  });

  it('does not count owner speech given before the prepare', async () => {
    const { call, runOperation, session } = await openSession();
    session.recordOwnerSpeech('はい');
    await call('prepare_ok');

    const refused = await confirmYes(call);

    expect({ ok: refused.ok, error: refused.error }).toEqual({
      ok: false,
      error: 'owner_speech_not_heard',
    });
    expect(runOperation).not.toHaveBeenCalled();
  });

  it('clears owner speech when a new prepare replaces the pending action', async () => {
    const { call, runOperation, session } = await openSession();
    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('は');
    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('い');

    const refused = await confirmYes(call);

    expect({ ok: refused.ok, error: refused.error }).toEqual({
      ok: false,
      error: 'owner_speech_not_heard',
    });
    expect(runOperation).not.toHaveBeenCalled();
  });

  it('requires new owner speech for each write after a successful confirm', async () => {
    const { call, runOperation, session } = await openSession();
    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    session.recordOwnerSpeech('はい');
    const first = await confirmYes(call);
    expect(first.ok).toBe(true);

    await call('prepare_ok');
    session.recordAssistantSpeech(lastReadBack);
    const second = await confirmYes(call);

    expect({ ok: second.ok, error: second.error }).toEqual({
      ok: false,
      error: 'owner_speech_not_heard',
    });
    expect(runOperation).toHaveBeenCalledTimes(1);
  });
});

describe('VoiceConsoleSession read-back window', () => {
  it('opens the owner-speech window only with assistant speech after a prepare', async () => {
    const cases: {
      name: string;
      steps: ReadBackStep[];
      expectedError: string | undefined;
    }[] = [
      {
        name: 'はい heard after prepare but before any assistant speech is refused',
        steps: [{ owner: 'はい' }],
        expectedError: 'owner_speech_not_heard',
      },
      {
        name: 'assistant speech then はい is accepted',
        steps: [{ assistant: READ_BACK }, { owner: 'はい' }],
        expectedError: undefined,
      },
      {
        name: 'assistant speech without はい is refused',
        steps: [{ assistant: READ_BACK }, { owner: 'うん' }],
        expectedError: 'owner_speech_not_heard',
      },
      {
        name: 'assistant speech, はい, then more assistant speech is still accepted',
        steps: [
          { assistant: READ_BACK },
          { owner: 'はい' },
          { assistant: '続き' },
        ],
        expectedError: undefined,
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      for (const step of testCase.steps) {
        if ('assistant' in step) {
          session.recordAssistantSpeech(resolveSpeech(step.assistant));
        } else {
          session.recordOwnerSpeech(step.owner);
        }
      }

      const result = await confirmYes(call);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: testCase.expectedError === undefined,
        error: testCase.expectedError,
      });
    }
  });
});

describe('VoiceConsoleSession strict owner yes', () => {
  it('accepts owner speech only when the whole normalised speech is はい', async () => {
    const cases = [
      { name: 'はい with a full stop', fragments: ['はい。'], accepted: true },
      { name: 'plain はい', fragments: ['はい'], accepted: true },
      { name: 'はい with a space', fragments: [' はい '], accepted: true },
      {
        name: 'はい inside a sentence about closing',
        fragments: ['閉じてはいけない'],
        accepted: false,
      },
      {
        name: 'はい followed by じゃない',
        fragments: ['はいじゃない'],
        accepted: false,
      },
      {
        name: 'はい followed by a request',
        fragments: ['はい、お願いします'],
        accepted: false,
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      session.recordAssistantSpeech(lastReadBack);
      for (const fragment of testCase.fragments) {
        session.recordOwnerSpeech(fragment);
      }

      const result = await confirmYes(call);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: testCase.accepted,
        error: testCase.accepted ? undefined : 'owner_speech_not_heard',
      });
    }
  });

  it('normalises the model-supplied owner_reply the same way', async () => {
    const cases = [
      { name: 'はい with a full stop', ownerReply: 'はい。', accepted: true },
      { name: 'はいじゃない', ownerReply: 'はいじゃない', accepted: false },
      { name: 'いいえ', ownerReply: 'いいえ', accepted: false },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      session.recordAssistantSpeech(lastReadBack);
      session.recordOwnerSpeech('はい');

      const result = await call('confirm_pending_action', {
        action_id: FIXED_ACTION_ID,
        owner_reply: testCase.ownerReply,
      });

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: testCase.accepted,
        error: testCase.accepted ? undefined : 'owner_reply_not_yes',
      });
    }
  });
});

describe('VoiceConsoleSession title-gated read-back', () => {
  it('opens the owner-speech window only once the normalised item title has been spoken', async () => {
    const cases: {
      name: string;
      steps: ReadBackStep[];
      accepted: boolean;
    }[] = [
      {
        name: 'preamble without the title does not open the window',
        steps: [{ assistant: '確認します' }, { owner: 'はい' }],
        accepted: false,
      },
      {
        name: 'owner speech before the title is spoken is ignored',
        steps: [{ owner: 'はい' }, { assistant: READ_BACK }],
        accepted: false,
      },
      {
        name: 'the title spoken then はい is accepted',
        steps: [{ assistant: READ_BACK }, { owner: 'はい' }],
        accepted: true,
      },
      {
        name: 'the title alone, without the rest of the read-back, does not open the window',
        steps: [{ assistant: 'Fix login' }, { owner: 'はい' }],
        accepted: false,
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      for (const step of testCase.steps) {
        if ('assistant' in step) {
          session.recordAssistantSpeech(resolveSpeech(step.assistant));
        } else {
          session.recordOwnerSpeech(step.owner);
        }
      }

      const result = await confirmYes(call);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: testCase.accepted,
        error: testCase.accepted ? undefined : 'owner_speech_not_heard',
      });
    }
  });
});

describe('VoiceConsoleSession pull request review read-back title', () => {
  const normaliseSpeech = (text: string): string =>
    text.replace(/[\s。、.,!?！？]/gu, '');

  it('speaks the normalised item title in every pull request review read-back', async () => {
    const cases = [
      { action: 'approve_and_merge', args: { action: 'approve_and_merge' } },
      {
        action: 'request_changes',
        args: { action: 'request_changes', comment_text: 'Z' },
      },
      { action: 'unnecessary', args: { action: 'unnecessary' } },
      { action: 'totally_wrong', args: { action: 'totally_wrong' } },
    ];

    for (const testCase of cases) {
      const { call } = await openSession({ position: 4 });

      const prepared = await call('prepare_pull_request_review', testCase.args);
      const readBack = normaliseSpeech(String(prepared.readBack));

      expect({
        action: testCase.action,
        ok: prepared.ok,
        titleSpoken: readBack.includes(normaliseSpeech('Review pull 9')),
      }).toEqual({
        action: testCase.action,
        ok: true,
        titleSpoken: true,
      });
    }
  });

  it('speaks a title containing spaces and punctuation so that it still gates after normalisation', async () => {
    const punctuatedDir = fs.mkdtempSync(path.join(root, 'punctuated-'));
    writeListFile(punctuatedDir, 'umino', 'prs', [
      item({
        number: 9,
        url: PR9,
        projectItemId: 'PVTI_3',
        title: 'Review: pull 9, now!',
        isPr: true,
      }),
    ]);
    const { call } = await openSession({ consoleDataOutputDir: punctuatedDir });

    const prepared = await call('prepare_pull_request_review', {
      action: 'approve_and_merge',
    });
    const readBack = normaliseSpeech(String(prepared.readBack));

    expect({
      ok: prepared.ok,
      titleSpoken: readBack.includes(normaliseSpeech('Review: pull 9, now!')),
    }).toEqual({ ok: true, titleSpoken: true });
  });
});

describe('VoiceConsoleSession read-back opens only on the read-back of the pending action', () => {
  it('does not open the owner-speech window on assistant speech that only names the task title', async () => {
    const cases = [
      {
        name: 'title named as a sentence of its own',
        preamble: '「Fix login」について確認します。',
      },
      { name: 'title named as a question', preamble: 'Fix login ですね？' },
      { name: 'title named in a greeting', preamble: 'Fix login の件です' },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      await call('prepare_ok');
      session.recordAssistantSpeech(testCase.preamble);
      session.recordOwnerSpeech('はい');

      const result = await confirmYes(call);

      expect({
        name: testCase.name,
        ok: result.ok,
        error: result.error,
      }).toEqual({
        name: testCase.name,
        ok: false,
        error: 'owner_speech_not_heard',
      });
    }
  });

  it('accepts はい once the full read-back of the pending action has been spoken', async () => {
    const { call, session } = await openSession();
    const prepared = await call('prepare_ok');
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('はい');

    const result = await confirmYes(call);

    expect({ ok: result.ok, error: result.error }).toEqual({
      ok: true,
      error: undefined,
    });
  });
});

describe('VoiceConsoleSession bare はい counts only after the read-back of that action', () => {
  it('confirms only when はい follows the completed read-back of the pending action', async () => {
    const cases: {
      name: string;
      steps: (
        readBack: string,
        partial: string,
        rest: string,
      ) => ReadBackStep[];
      accepted: boolean;
    }[] = [
      {
        name: 'bare はい with no read-back is refused',
        steps: () => [{ owner: 'はい' }],
        accepted: false,
      },
      {
        name: 'はい heard while the read-back is still incomplete is refused',
        steps: (_readBack, partial) => [
          { assistant: partial },
          { owner: 'はい' },
        ],
        accepted: false,
      },
      {
        name: 'はい after the completed read-back is accepted',
        steps: (readBack) => [{ assistant: readBack }, { owner: 'はい' }],
        accepted: true,
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession();
      const prepared = await call('prepare_ok');
      const readBack = String(prepared.readBack);
      const titleEnd = readBack.indexOf(ITEM_TITLE) + ITEM_TITLE.length;
      const partial = readBack.slice(0, titleEnd);
      const rest = readBack.slice(titleEnd);
      for (const step of testCase.steps(readBack, partial, rest)) {
        if ('assistant' in step) {
          session.recordAssistantSpeech(resolveSpeech(step.assistant));
        } else {
          session.recordOwnerSpeech(step.owner);
        }
      }

      const result = await confirmYes(call);

      expect({
        name: testCase.name,
        ok: result.ok,
      }).toEqual({
        name: testCase.name,
        ok: testCase.accepted,
      });
    }
  });

  it('refuses はい spoken before the read-back completes and accepts a later はい after it completes', async () => {
    const { call, session } = await openSession();
    const prepared = await call('prepare_ok');
    const readBack = String(prepared.readBack);
    const titleEnd = readBack.indexOf(ITEM_TITLE) + ITEM_TITLE.length;

    session.recordAssistantSpeech(readBack.slice(0, titleEnd));
    session.recordOwnerSpeech('はい');
    const early = await confirmYes(call);

    session.recordAssistantSpeech(readBack.slice(titleEnd));
    session.recordOwnerSpeech('はい');
    const late = await confirmYes(call);

    expect({ earlyOk: early.ok, lateOk: late.ok }).toEqual({
      earlyOk: false,
      lateOk: true,
    });
  });
});

describe('VoiceConsoleSession navigation cancels a staged write', () => {
  it('clears the staged action on navigation and reports the cancellation in the tool output', async () => {
    const cases = [
      {
        name: 'next_task',
        openPosition: 1,
        navigate: { tool: 'next_task', args: {} },
      },
      {
        name: 'previous_task',
        openPosition: 2,
        navigate: { tool: 'previous_task', args: {} },
      },
      {
        name: 'jump_to_task',
        openPosition: 1,
        navigate: { tool: 'jump_to_task', args: { position: 2 } },
      },
      {
        name: 'repeat_current_task',
        openPosition: 1,
        navigate: { tool: 'repeat_current_task', args: {} },
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession({
        position: testCase.openPosition,
      });
      const prepared = await call('prepare_ok');
      const readBack = String(prepared.readBack);

      const navigated = await call(
        testCase.navigate.tool,
        testCase.navigate.args,
      );
      session.recordAssistantSpeech(readBack);
      session.recordOwnerSpeech('はい');
      const confirmed = await confirmYes(call);

      expect({
        name: testCase.name,
        cancellationReported: navigated.stagedActionCancelled === true,
        confirmOk: confirmed.ok,
      }).toEqual({
        name: testCase.name,
        cancellationReported: true,
        confirmOk: false,
      });
    }
  });
});

describe('VoiceConsoleSession request_changes removes the item from the queue', () => {
  it('removes the item after a completing pull request review is confirmed', async () => {
    const cases = [
      {
        name: 'request_changes removes the item',
        args: { action: 'request_changes', comment_text: 'Z' },
        keepsItem: false,
      },
      {
        name: 'approve_and_merge removes the item',
        args: { action: 'approve_and_merge' },
        keepsItem: false,
      },
    ];

    for (const testCase of cases) {
      const { call, session } = await openSession({ position: 4 });
      const before = await call('queue_overview');
      expect(collectNumbers(before)).toContain(4);

      const prepared = await call('prepare_pull_request_review', testCase.args);
      session.recordAssistantSpeech(String(prepared.readBack));
      session.recordOwnerSpeech('はい');
      const confirmed = await confirmYes(call);
      const after = await call('queue_overview');

      expect({
        name: testCase.name,
        ok: confirmed.ok,
        itemStillQueued: collectNumbers(after).includes(4),
      }).toEqual({
        name: testCase.name,
        ok: true,
        itemStillQueued: testCase.keepsItem,
      });
    }
  });
});

describe('VoiceConsoleSession staged write survives a failed navigation', () => {
  it('keeps the staged write when the navigation moves nothing and confirms it after はい', async () => {
    const { call, session } = await openSession({ position: 4 });
    const prepared = await call('prepare_ok');
    const navigated = await call('next_task');
    session.recordAssistantSpeech(String(prepared.readBack));
    session.recordOwnerSpeech('はい');
    const confirmed = await confirmYes(call);

    expect({
      navigationOk: navigated.ok,
      navigationError: navigated.error,
      stagedActionCancelled: navigated.stagedActionCancelled,
      confirmOk: confirmed.ok,
    }).toEqual({
      navigationOk: false,
      navigationError: 'end_of_queue',
      stagedActionCancelled: undefined,
      confirmOk: true,
    });
  });
});

describe('VoiceConsoleSession read-back gate ignores quotation marks and URLs', () => {
  it('opens the window when the read-back is spoken without the quotation marks or the pull request URL', async () => {
    const { call, session } = await openSession({ position: 4 });
    const prepared = await call('prepare_pull_request_review', {
      action: 'approve_and_merge',
    });
    const spoken = String(prepared.readBack)
      .replace(/[「」]/g, '')
      .replace(/https?:\/\/\S+/g, '');
    session.recordAssistantSpeech(spoken);
    session.recordOwnerSpeech('はい');

    const confirmed = await confirmYes(call);

    expect({ ok: confirmed.ok, error: confirmed.error }).toEqual({
      ok: true,
      error: undefined,
    });
  });
});
