import {
  OwnerCallFileRepository,
  PendingOwnerCall,
  SessionCommandRepository,
  SessionHost,
  SessionHostRepository,
  SessionReadCommand,
  SessionReadCommandResult,
} from '../adapter-interfaces/LiveSessionToolRepository';
import { Issue } from '../../entities/Issue';
import { IssueComment } from '../adapter-interfaces/IssueRepository';
import {
  LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES,
  LIVE_SESSION_TOOL_NAMES,
  LiveSessionToolCallInput,
  LiveSessionToolCallOutcome,
} from './LiveSessionToolCall';
import {
  LiveSessionIssueReader,
  LiveSessionToolCallUseCase,
} from './LiveSessionToolCallUseCase';

const ISSUE_SESSION_NAME =
  'https_//github_com/example-org/example-repo/issues/12';
const ISSUE_URL = 'https://github.com/example-org/example-repo/issues/12';
const PLAIN_SESSION_NAME = 'plain-session';
const REMOTE_HOST_NAME = 'example-worker';

const REMOTE_HOST: SessionHost = {
  kind: 'remote',
  name: REMOTE_HOST_NAME,
  address: 'worker.example.invalid',
  port: 22,
  user: 'worker',
};

const exited = (stdout: string, exitCode = 0): SessionReadCommandResult => ({
  kind: 'exited',
  exitCode,
  stdout,
});

class InMemoryOwnerCallFileRepository implements OwnerCallFileRepository {
  constructor(private readonly calls: PendingOwnerCall[]) {}

  listPendingOwnerCalls = (): PendingOwnerCall[] => this.calls;
}

class InMemorySessionHostRepository implements SessionHostRepository {
  readonly requestedIssueUrls: string[] = [];

  constructor(private readonly hostsByIssueUrl: Record<string, SessionHost>) {}

  findHostOfIssueSession = (issueUrl: string): SessionHost => {
    this.requestedIssueUrls.push(issueUrl);
    return this.hostsByIssueUrl[issueUrl] ?? { kind: 'local' };
  };
}

type CommandResponder = (
  host: SessionHost,
  command: SessionReadCommand,
) => SessionReadCommandResult;

class InMemorySessionCommandRepository implements SessionCommandRepository {
  readonly executed: { host: SessionHost; command: SessionReadCommand }[] = [];

  constructor(private readonly respond: CommandResponder) {}

  run = (
    host: SessionHost,
    command: SessionReadCommand,
  ): Promise<SessionReadCommandResult> => {
    this.executed.push({ host, command });
    return Promise.resolve(this.respond(host, command));
  };
}

const buildIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'example-org/example-repo',
  number: 12,
  title: 'Example task title',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: ISSUE_URL,
  assignees: [],
  labels: [],
  org: 'example-org',
  repo: 'example-repo',
  body: 'Example task body',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  author: 'example-author',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

const buildIssueReader = (
  issue: Issue | null,
  comments: IssueComment[],
): LiveSessionIssueReader => ({
  getIssueByUrl: () => Promise.resolve(issue),
  getIssueOrPullRequestBody: () =>
    Promise.resolve(issue === null ? '' : issue.body),
  getIssueOrPullRequestComments: () => Promise.resolve(comments),
});

const unusedIssueReader = buildIssueReader(null, []);

type Harness = {
  useCase: LiveSessionToolCallUseCase;
  commands: InMemorySessionCommandRepository;
  hosts: InMemorySessionHostRepository;
};

const buildHarness = (options: {
  ownerCalls?: PendingOwnerCall[];
  hostsByIssueUrl?: Record<string, SessionHost>;
  respond?: CommandResponder;
  issues?: LiveSessionIssueReader;
}): Harness => {
  const commands = new InMemorySessionCommandRepository(
    options.respond ?? (() => exited('', 1)),
  );
  const hosts = new InMemorySessionHostRepository(
    options.hostsByIssueUrl ?? {},
  );
  const useCase = new LiveSessionToolCallUseCase({
    ownerCalls: new InMemoryOwnerCallFileRepository(options.ownerCalls ?? []),
    hosts,
    commands,
    issues: options.issues ?? unusedIssueReader,
  });
  return { useCase, commands, hosts };
};

const call = (
  name: string,
  args: Record<string, unknown> = {},
  sessionName: string | null = null,
): LiveSessionToolCallInput => ({ name, arguments: args, sessionName });

const outputOf = (outcome: LiveSessionToolCallOutcome): string => {
  if (outcome.kind !== 'output') {
    throw new Error(`expected an output outcome, got ${outcome.kind}`);
  }
  return outcome.output;
};

describe('LiveSessionToolCallUseCase unknown tool and argument validation', () => {
  it.each([
    {
      name: 'answers an unknown tool name with unknownTool',
      input: call('session_reply_delete'),
      expected: { kind: 'unknownTool' },
    },
    {
      name: 'rejects a screen read with a lineCount above the maximum',
      input: call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {
        lineCount: 301,
      }),
      expected: { kind: 'invalidArguments' },
    },
    {
      name: 'rejects a screen read with a lineCount of zero',
      input: call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, { lineCount: 0 }),
      expected: { kind: 'invalidArguments' },
    },
    {
      name: 'rejects a screen read with a fractional lineCount',
      input: call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {
        lineCount: 1.5,
      }),
      expected: { kind: 'invalidArguments' },
    },
    {
      name: 'rejects a non-string sessionName',
      input: call(LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead, {
        sessionName: 7,
      }),
      expected: { kind: 'invalidArguments' },
    },
    {
      name: 'rejects a file read without a path',
      input: call(
        LIVE_SESSION_TOOL_NAMES.sessionFileRead,
        {},
        PLAIN_SESSION_NAME,
      ),
      expected: { kind: 'invalidArguments' },
    },
    {
      name: 'rejects a file read with an empty path',
      input: call(
        LIVE_SESSION_TOOL_NAMES.sessionFileRead,
        { path: '  ' },
        PLAIN_SESSION_NAME,
      ),
      expected: { kind: 'invalidArguments' },
    },
  ])('$name', async ({ input, expected }) => {
    const { useCase, commands } = buildHarness({});
    expect(await useCase.run(input)).toEqual(expected);
    expect(commands.executed).toEqual([]);
  });
});

describe('LiveSessionToolCallUseCase calling_sessions_list', () => {
  it('lists each pending owner call with its host and derived task issue URL', async () => {
    const { useCase, hosts } = buildHarness({
      ownerCalls: [
        { sessionName: ISSUE_SESSION_NAME, calledAt: '2026-11-23T01:00:00Z' },
        { sessionName: PLAIN_SESSION_NAME, calledAt: '2026-11-23T02:00:00Z' },
      ],
      hostsByIssueUrl: { [ISSUE_URL]: REMOTE_HOST },
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.callingSessionsList),
    );
    expect(JSON.parse(outputOf(outcome))).toEqual({
      calls: [
        {
          sessionName: ISSUE_SESSION_NAME,
          calledAt: '2026-11-23T01:00:00Z',
          host: REMOTE_HOST_NAME,
          taskIssueUrl: ISSUE_URL,
        },
        {
          sessionName: PLAIN_SESSION_NAME,
          calledAt: '2026-11-23T02:00:00Z',
          host: 'local',
          taskIssueUrl: null,
        },
      ],
    });
    expect(hosts.requestedIssueUrls).toEqual([ISSUE_URL]);
  });

  it('returns an empty list when no owner call is pending', async () => {
    const { useCase } = buildHarness({ ownerCalls: [] });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.callingSessionsList),
    );
    expect(JSON.parse(outputOf(outcome))).toEqual({ calls: [] });
  });
});

describe('LiveSessionToolCallUseCase session_screen_read', () => {
  it('reads the default 80 lines from the local tmux session', async () => {
    const { useCase, commands } = buildHarness({
      respond: (_host, command) =>
        command.kind === 'tmuxHasSession' ? exited('') : exited('screen text'),
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, PLAIN_SESSION_NAME),
    );
    expect(outputOf(outcome)).toBe('screen text');
    expect(commands.executed[1]).toEqual({
      host: { kind: 'local' },
      command: {
        kind: 'tmuxCapturePane',
        sessionName: PLAIN_SESSION_NAME,
      },
    });
  });

  it.each([
    {
      name: 'returns exactly the last 80 lines by default',
      arguments: {},
      expectedLineCount: 80,
    },
    {
      name: 'returns exactly the last 300 lines at the maximum',
      arguments: { lineCount: 300 },
      expectedLineCount: 300,
    },
    {
      name: 'returns exactly the last 5 lines when asked for 5',
      arguments: { lineCount: 5 },
      expectedLineCount: 5,
    },
  ])('$name', async ({ arguments: toolArguments, expectedLineCount }) => {
    const history = Array.from(
      { length: 400 },
      (_unused, index) => `row-${index + 1}`,
    );
    const { useCase } = buildHarness({
      respond: (_host, command) =>
        command.kind === 'tmuxHasSession'
          ? exited('')
          : exited(`${history.join('\n')}\n\n\n`),
    });
    const lines = outputOf(
      await useCase.run(
        call(
          LIVE_SESSION_TOOL_NAMES.sessionScreenRead,
          toolArguments,
          PLAIN_SESSION_NAME,
        ),
      ),
    ).split('\n');
    expect(lines).toHaveLength(expectedLineCount);
    expect(lines[lines.length - 1]).toBe('row-400');
  });

  it('drops trailing empty pane rows before taking the last lines', async () => {
    const { useCase } = buildHarness({
      respond: (_host, command) =>
        command.kind === 'tmuxHasSession'
          ? exited('')
          : exited('alpha\nbeta\n\n\n\n'),
    });
    expect(
      outputOf(
        await useCase.run(
          call(
            LIVE_SESSION_TOOL_NAMES.sessionScreenRead,
            { lineCount: 3 },
            PLAIN_SESSION_NAME,
          ),
        ),
      ),
    ).toBe('alpha\nbeta');
  });

  it('uses the arguments sessionName before the session the app is handling', async () => {
    const { useCase, commands } = buildHarness({
      respond: () => exited('ok'),
    });
    await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionScreenRead,
        { sessionName: PLAIN_SESSION_NAME },
        'other-session',
      ),
    );
    expect(commands.executed[0]?.command).toEqual({
      kind: 'tmuxHasSession',
      sessionName: PLAIN_SESSION_NAME,
    });
  });

  it('falls back to the session the app is handling when arguments give none', async () => {
    const { useCase, commands } = buildHarness({
      respond: () => exited('ok'),
    });
    await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, PLAIN_SESSION_NAME),
    );
    expect(commands.executed[0]?.command).toEqual({
      kind: 'tmuxHasSession',
      sessionName: PLAIN_SESSION_NAME,
    });
  });

  it('answers with a clear text when no session name is given', async () => {
    const { useCase, commands } = buildHarness({});
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead),
    );
    expect(outputOf(outcome)).toBe('セッション名が指定されていません。');
    expect(commands.executed).toEqual([]);
  });

  it('answers with a clear text when the session is not running', async () => {
    const { useCase } = buildHarness({
      respond: () => exited('', 1),
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, 'unknown-session'),
    );
    expect(outputOf(outcome)).toBe('セッションが見つかりません。');
  });

  it('answers with a clear text when the session host cannot be reached', async () => {
    const { useCase } = buildHarness({
      hostsByIssueUrl: { [ISSUE_URL]: REMOTE_HOST },
      respond: () => ({ kind: 'unreachable' }),
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, ISSUE_SESSION_NAME),
    );
    expect(outputOf(outcome)).toBe(
      'セッションが動いているホストに接続できませんでした。',
    );
  });

  it('answers with a clear text when the session host is not in the worker host table', async () => {
    const { useCase, commands } = buildHarness({
      hostsByIssueUrl: {
        [ISSUE_URL]: { kind: 'unknownRemote', name: 'unlisted-host' },
      },
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, ISSUE_SESSION_NAME),
    );
    expect(outputOf(outcome)).toBe(
      'セッションが動いているホストが作業ホストの一覧にありません。',
    );
    expect(commands.executed).toEqual([]);
  });

  it('runs the capture on the remote host that runs the session', async () => {
    const { useCase, commands } = buildHarness({
      hostsByIssueUrl: { [ISSUE_URL]: REMOTE_HOST },
      respond: () => exited('remote screen'),
    });
    const outcome = await useCase.run(
      call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, ISSUE_SESSION_NAME),
    );
    expect(outputOf(outcome)).toBe('remote screen');
    expect(commands.executed.every((entry) => entry.host === REMOTE_HOST)).toBe(
      true,
    );
  });

  it('truncates a screen longer than the output limit with a note', async () => {
    const longScreen = 'a'.repeat(LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES + 100);
    const { useCase } = buildHarness({
      respond: (_host, command) =>
        command.kind === 'tmuxHasSession' ? exited('') : exited(longScreen),
    });
    const output = outputOf(
      await useCase.run(
        call(LIVE_SESSION_TOOL_NAMES.sessionScreenRead, {}, PLAIN_SESSION_NAME),
      ),
    );
    expect(output).toContain('[truncated: output longer than');
    expect(output.length).toBeLessThan(longScreen.length);
  });
});

describe('LiveSessionToolCallUseCase session_task_issue_read', () => {
  it('answers with a clear text when the task issue URL cannot be derived', async () => {
    const { useCase } = buildHarness({});
    const outcome = await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead,
        {},
        PLAIN_SESSION_NAME,
      ),
    );
    expect(outputOf(outcome)).toBe(
      'セッション名からタスク Issue の URL を特定できません。',
    );
  });

  it('answers with a clear text when the issue does not exist', async () => {
    const { useCase } = buildHarness({
      issues: buildIssueReader(null, []),
    });
    const outcome = await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead,
        {},
        ISSUE_SESSION_NAME,
      ),
    );
    expect(outputOf(outcome)).toBe('タスク Issue が見つかりません。');
  });

  it('returns the title, body and the latest comment of the task issue', async () => {
    const older: IssueComment = {
      id: 1,
      author: 'first-author',
      body: 'older comment',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    };
    const latest: IssueComment = {
      id: 2,
      author: 'second-author',
      body: 'latest comment',
      createdAt: new Date('2026-01-03T00:00:00Z'),
    };
    const { useCase } = buildHarness({
      issues: buildIssueReader(buildIssue({ body: 'task body text' }), [
        latest,
        older,
      ]),
    });
    const outcome = await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead,
        {},
        ISSUE_SESSION_NAME,
      ),
    );
    expect(JSON.parse(outputOf(outcome))).toEqual({
      url: ISSUE_URL,
      title: 'Example task title',
      body: 'task body text',
      latestComment: {
        author: 'second-author',
        createdAt: '2026-01-03T00:00:00.000Z',
        body: 'latest comment',
      },
    });
  });

  it('returns a null latest comment when the issue has no comment', async () => {
    const { useCase } = buildHarness({
      issues: buildIssueReader(buildIssue({}), []),
    });
    const outcome = await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionTaskIssueRead,
        {},
        ISSUE_SESSION_NAME,
      ),
    );
    expect(JSON.parse(outputOf(outcome))).toMatchObject({
      latestComment: null,
    });
  });
});

describe('LiveSessionToolCallUseCase session_file_read', () => {
  const FOLDER = '/work/project';

  const fileRespond =
    (
      overrides: Partial<{
        panePath: SessionReadCommandResult;
        folderReal: SessionReadCommandResult;
        targetReal: SessionReadCommandResult;
        fileType: SessionReadCommandResult;
        content: SessionReadCommandResult;
        listing: SessionReadCommandResult;
      }>,
    ): CommandResponder =>
    (_host, command) => {
      switch (command.kind) {
        case 'tmuxHasSession':
          return exited('');
        case 'tmuxPanePath':
          return overrides.panePath ?? exited(`${FOLDER}\n`);
        case 'realPath':
          return command.path === FOLDER
            ? (overrides.folderReal ?? exited(`${FOLDER}\n`))
            : (overrides.targetReal ?? exited(`${FOLDER}/src/index.ts\n`));
        case 'fileType':
          return overrides.fileType ?? exited('regular file\n');
        case 'readFileHead':
          return overrides.content ?? exited('console.log(1);\n');
        case 'listDirectory':
          return overrides.listing ?? exited('zeta/\nalpha.ts\nbeta/\n');
        case 'tmuxCapturePane':
          return exited('');
      }
    };

  it.each([
    {
      name: 'reads a text file inside the session folder',
      overrides: {},
      path: 'src/index.ts',
      expected: 'console.log(1);\n',
    },
    {
      name: 'lists a folder as a sorted listing',
      overrides: {
        fileType: exited('directory\n'),
        targetReal: exited(`${FOLDER}/src\n`),
      },
      path: 'src',
      expected: 'alpha.ts\nbeta/\nzeta/',
    },
    {
      name: 'refuses a binary file',
      overrides: { content: exited('ELF\u0000binary') },
      path: 'bin/tool',
      expected: 'バイナリファイルのため内容は表示できません。',
    },
    {
      name: 'refuses a path that escapes the folder through a symlink',
      overrides: { targetReal: exited('/etc/hosts\n') },
      path: 'link-to-hosts',
      expected:
        '指定されたパスはセッションの作業フォルダの外にあるため、読めません。',
    },
    {
      name: 'refuses an absolute path outside the folder',
      overrides: { targetReal: exited('/etc/hosts\n') },
      path: '/etc/hosts',
      expected:
        '指定されたパスはセッションの作業フォルダの外にあるため、読めません。',
    },
    {
      name: 'answers a missing file with a clear text',
      overrides: { targetReal: exited('', 1) },
      path: 'missing.txt',
      expected: 'ファイルまたはフォルダが見つかりません。',
    },
    {
      name: 'answers a file of an unsupported type with a clear text',
      overrides: { fileType: exited('fifo\n') },
      path: 'pipe',
      expected: '通常のファイルでもフォルダでもないため、読めません。',
    },
    {
      name: 'answers when the session folder cannot be read',
      overrides: { panePath: exited('', 1) },
      path: 'src/index.ts',
      expected: 'セッションの作業フォルダを取得できませんでした。',
    },
  ])('$name', async ({ overrides, path, expected }) => {
    const { useCase } = buildHarness({
      respond: fileRespond(overrides),
    });
    const outcome = await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionFileRead,
        { path },
        PLAIN_SESSION_NAME,
      ),
    );
    expect(outputOf(outcome)).toBe(expected);
  });

  it('passes the byte limit plus one to the head read so truncation is detectable', async () => {
    const { useCase, commands } = buildHarness({
      respond: fileRespond({}),
    });
    await useCase.run(
      call(
        LIVE_SESSION_TOOL_NAMES.sessionFileRead,
        { path: 'src/index.ts' },
        PLAIN_SESSION_NAME,
      ),
    );
    expect(
      commands.executed.find((entry) => entry.command.kind === 'readFileHead')
        ?.command,
    ).toEqual({
      kind: 'readFileHead',
      path: `${FOLDER}/src/index.ts`,
      byteLimit: LIVE_SESSION_TOOL_OUTPUT_LIMIT_BYTES + 1,
    });
  });
});
