import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcTakeOwnershipWorkerSessionReader } from './ProcTakeOwnershipWorkerSessionReader';

type FakeProcess = {
  pid: number;
  parentPid: number;
  comm: string;
  cmdline: string;
  environ: Record<string, string>;
};

const issueUrl = 'https://github.com/HiromiShikata/example/issues/1';
const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;
const wrapperCommandLine = (logName: string): string =>
  argv(
    'bash',
    '-c',
    `timeout 3h claude-agent -p "Take ownership of ${issueUrl}" | tee /home/user/logs-aw/${logName}.log`,
  );
const timeoutCommandLine = argv(
  'timeout',
  '--kill-after=60s',
  '3h',
  'claude-agent',
  '-p',
  `Take ownership of ${issueUrl}`,
);
const claudeAgentCommandLine = argv(
  'claude-agent',
  '-p',
  `Take ownership of ${issueUrl}`,
);
const claudeCommandLine = argv(
  'claude',
  '--verbose',
  '-p',
  `Take ownership of ${issueUrl}`,
);

describe('ProcTakeOwnershipWorkerSessionReader', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fake-proc-worker-session-'),
    );
  });

  afterEach(() => {
    fs.rmSync(procDirectory, { recursive: true, force: true });
  });

  const writeProcess = (fakeProcess: FakeProcess): void => {
    const processDirectory = path.join(procDirectory, String(fakeProcess.pid));
    fs.mkdirSync(processDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      fakeProcess.cmdline,
    );
    fs.writeFileSync(
      path.join(processDirectory, 'environ'),
      Object.entries(fakeProcess.environ)
        .map(([key, value]) => `${key}=${value}\0`)
        .join(''),
    );
    fs.writeFileSync(
      path.join(processDirectory, 'stat'),
      `${fakeProcess.pid} (${fakeProcess.comm}) S ${fakeProcess.parentPid} ${fakeProcess.pid} ${fakeProcess.pid} 0 -1 4194304`,
    );
  };

  const writeWorkerTree = (tree: {
    wrapperPid: number;
    wrapperToken: string;
    logName: string;
    claudeToken: string | null;
  }): void => {
    writeProcess({
      pid: tree.wrapperPid,
      parentPid: 1,
      comm: 'bash',
      cmdline: wrapperCommandLine(tree.logName),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.wrapperToken },
    });
    writeProcess({
      pid: tree.wrapperPid + 1,
      parentPid: tree.wrapperPid,
      comm: 'bash',
      cmdline: wrapperCommandLine(tree.logName),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.wrapperToken },
    });
    if (tree.claudeToken === null) {
      return;
    }
    writeProcess({
      pid: tree.wrapperPid + 2,
      parentPid: tree.wrapperPid,
      comm: 'timeout',
      cmdline: timeoutCommandLine,
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
    });
    writeProcess({
      pid: tree.wrapperPid + 3,
      parentPid: tree.wrapperPid + 2,
      comm: 'claude-agent',
      cmdline: claudeAgentCommandLine,
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
    });
    writeProcess({
      pid: tree.wrapperPid + 4,
      parentPid: tree.wrapperPid + 3,
      comm: 'claude',
      cmdline: claudeCommandLine,
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
    });
  };

  it('uses the token of the claude descendant when the wrapper and its claude child hold different tokens', () => {
    writeWorkerTree({
      wrapperPid: 100,
      wrapperToken: 'wrapper-token',
      logName: 'worker-a',
      claudeToken: 'claude-token',
    });
    writeProcess({
      pid: 105,
      parentPid: 100,
      comm: 'tee',
      cmdline: argv('tee', '/home/user/logs-aw/worker-a.log'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'wrapper-token' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);
    const sessions = reader.listWorkerSessions();

    expect(
      sessions.map((session) => ({
        rootProcessId: session.rootProcessId,
        sessionToken: session.sessionToken,
        workerProcessIds: session.workerProcesses.map(
          (workerProcess) => workerProcess.processId,
        ),
      })),
    ).toEqual([
      {
        rootProcessId: 100,
        sessionToken: 'claude-token',
        workerProcessIds: [100, 101, 102, 103, 104],
      },
    ]);
    expect(sessions[0].workerProcesses[0].rawCommandLine).toBe(
      wrapperCommandLine('worker-a'),
    );
  });

  it('uses the wrapper token when the worker has no claude descendant yet', () => {
    writeWorkerTree({
      wrapperPid: 200,
      wrapperToken: 'wrapper-token',
      logName: 'worker-b',
      claudeToken: null,
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[200, 'wrapper-token']]);
  });

  it('uses the wrapper token when the only descendants on another token are not the claude process', () => {
    writeWorkerTree({
      wrapperPid: 210,
      wrapperToken: 'wrapper-token',
      logName: 'worker-c',
      claudeToken: null,
    });
    writeProcess({
      pid: 212,
      parentPid: 210,
      comm: 'timeout',
      cmdline: timeoutCommandLine,
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'agent-token' },
    });
    writeProcess({
      pid: 213,
      parentPid: 212,
      comm: 'claude-agent',
      cmdline: claudeAgentCommandLine,
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'agent-token' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[210, 'wrapper-token']]);
  });

  it('uses the wrapper token when the claude descendant holds no oauth token', () => {
    writeWorkerTree({
      wrapperPid: 220,
      wrapperToken: 'wrapper-token',
      logName: 'worker-d',
      claudeToken: null,
    });
    writeProcess({
      pid: 224,
      parentPid: 220,
      comm: 'claude',
      cmdline: claudeCommandLine,
      environ: { HOME: '/home/user' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[220, 'wrapper-token']]);
  });

  it('uses the shallowest claude descendant when a claude process runs another claude process', () => {
    writeWorkerTree({
      wrapperPid: 300,
      wrapperToken: 'wrapper-token',
      logName: 'worker-e',
      claudeToken: 'outer-claude-token',
    });
    writeProcess({
      pid: 305,
      parentPid: 304,
      comm: 'bash',
      cmdline: argv('bash', '-c', 'claude -p hello'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'inner-claude-token' },
    });
    writeProcess({
      pid: 306,
      parentPid: 305,
      comm: 'claude',
      cmdline: argv('claude', '-p', 'hello'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'inner-claude-token' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[300, 'outer-claude-token']]);
  });

  it('returns one session per wrapper when two wrappers have claude children on the same token', () => {
    writeWorkerTree({
      wrapperPid: 400,
      wrapperToken: 'wrapper-token-1',
      logName: 'worker-f',
      claudeToken: 'shared-claude-token',
    });
    writeWorkerTree({
      wrapperPid: 500,
      wrapperToken: 'wrapper-token-2',
      logName: 'worker-g',
      claudeToken: 'shared-claude-token',
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([
      [400, 'shared-claude-token'],
      [500, 'shared-claude-token'],
    ]);
  });

  it('does not treat a claude process outside any worker as a session', () => {
    writeProcess({
      pid: 600,
      parentPid: 1,
      comm: 'claude',
      cmdline: argv('claude', '--name', issueUrl),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'interactive-token' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(reader.listWorkerSessions()).toEqual([]);
  });

  it('treats a worker process whose stat cannot be read as its own session', () => {
    writeProcess({
      pid: 700,
      parentPid: 1,
      comm: 'bash',
      cmdline: wrapperCommandLine('worker-h'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'wrapper-token' },
    });
    fs.rmSync(path.join(procDirectory, '700', 'stat'));

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[700, 'wrapper-token']]);
  });

  it('returns once when the parent pids of a wrapper and a non-worker process point at each other', () => {
    writeProcess({
      pid: 800,
      parentPid: 801,
      comm: 'bash',
      cmdline: wrapperCommandLine('worker-i'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'wrapper-token' },
    });
    writeProcess({
      pid: 801,
      parentPid: 800,
      comm: 'sleep',
      cmdline: argv('sleep', '5'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'wrapper-token' },
    });

    const reader = new ProcTakeOwnershipWorkerSessionReader(procDirectory);

    expect(
      reader
        .listWorkerSessions()
        .map((session) => [session.rootProcessId, session.sessionToken]),
    ).toEqual([[800, 'wrapper-token']]);
  });

  it('returns an empty list when the proc directory does not exist', () => {
    const reader = new ProcTakeOwnershipWorkerSessionReader(
      path.join(procDirectory, 'missing'),
    );

    expect(reader.listWorkerSessions()).toEqual([]);
  });
});
