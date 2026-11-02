import * as fs from 'fs';
import type * as NodeFs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcClaudeHandoverSessionRepository } from './ProcClaudeHandoverSessionRepository';

jest.mock('fs', () => {
  const actualFs: typeof NodeFs = jest.requireActual('fs');
  return {
    ...actualFs,
    readFileSync: jest.fn(actualFs.readFileSync),
  };
});

const mockFsReadFileSync = jest.mocked(fs.readFileSync);

const restoreReadFileSync = (): void => {
  const actualFs: typeof NodeFs = jest.requireActual('fs');
  mockFsReadFileSync.mockReset();
  mockFsReadFileSync.mockImplementation(actualFs.readFileSync);
};

const mockReadFileSyncFailureAt = (
  filePath: string,
  error: Error & { code: string },
): void => {
  const actualFs: typeof NodeFs = jest.requireActual('fs');
  mockFsReadFileSync.mockImplementation(
    (readPath: NodeFs.PathOrFileDescriptor) => {
      if (readPath === filePath) {
        throw error;
      }
      return actualFs.readFileSync(readPath, 'utf8');
    },
  );
};

type FakeProcess = {
  pid: number;
  comm: string;
  cmdline: string;
  environ: Record<string, string>;
  cgroup?: string;
};

const issueUrl = 'https://github.com/HiromiShikata/example/issues/1';
const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;

describe('ProcClaudeHandoverSessionRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fake-proc-handover-'),
    );
  });

  afterEach(() => {
    restoreReadFileSync();
    fs.rmSync(procDirectory, { recursive: true, force: true });
  });

  const writeProcess = (fakeProcess: FakeProcess): void => {
    const processDirectory = path.join(procDirectory, String(fakeProcess.pid));
    fs.mkdirSync(processDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(processDirectory, 'comm'),
      `${fakeProcess.comm}\n`,
    );
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      fakeProcess.cmdline,
    );
    const environBuffer = Object.entries(fakeProcess.environ)
      .map(([key, value]) => `${key}=${value}\0`)
      .join('');
    fs.writeFileSync(path.join(processDirectory, 'environ'), environBuffer);
    if (fakeProcess.cgroup !== undefined) {
      fs.writeFileSync(
        path.join(processDirectory, 'cgroup'),
        `0::${fakeProcess.cgroup}\n`,
      );
    }
  };

  it('classifies an issue-URL leader from a cl --name url launch', () => {
    writeProcess({
      pid: 201,
      comm: 'claude',
      cmdline: argv('claude', '--model', 'opus', '--name', issueUrl),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-a' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([
      {
        kind: 'issueUrlLeader',
        pid: 201,
        token: 'token-a',
        sessionName: issueUrl.replace(/[.:]/g, '_'),
        name: issueUrl,
        issueUrl,
        runsUnderWorkspacePreparationScript: false,
      },
    ]);
  });

  it('classifies a bare-name resident leader from a cl --name bare launch', () => {
    writeProcess({
      pid: 202,
      comm: 'claude',
      cmdline: argv('claude', '--name', 'app'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-b' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([
      {
        kind: 'bareNameLeader',
        pid: 202,
        token: 'token-b',
        sessionName: 'app',
        name: 'app',
        issueUrl: null,
        runsUnderWorkspacePreparationScript: false,
      },
    ]);
  });

  it('classifies an impl subagent from a -p task string containing an issue URL', () => {
    writeProcess({
      pid: 203,
      comm: 'claude',
      cmdline: argv(
        'claude',
        '--verbose',
        '-p',
        `Take ownership of ${issueUrl} and finish it`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-c' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([
      {
        kind: 'implSubagent',
        pid: 203,
        token: 'token-c',
        sessionName: null,
        name: null,
        issueUrl,
        runsUnderWorkspacePreparationScript: false,
      },
    ]);
  });

  it('normalizes dots and colons in a bare name to the tmux session name', () => {
    writeProcess({
      pid: 204,
      comm: 'claude',
      cmdline: argv('claude', '--name', 'tdpm-cli.v2'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-d' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()[0].sessionName).toBe(
      'tdpm-cli_v2',
    );
  });

  it('ignores a non-claude process even when it has a token and a name', () => {
    writeProcess({
      pid: 205,
      comm: 'node',
      cmdline: argv('node', '--name', 'app'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-e' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('ignores a claude process without an OAuth token', () => {
    writeProcess({
      pid: 206,
      comm: 'claude',
      cmdline: argv('claude', '--name', 'app'),
      environ: {},
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('ignores a claude process with neither a name nor an issue URL', () => {
    writeProcess({
      pid: 207,
      comm: 'claude',
      cmdline: argv('claude', '--model', 'opus'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-f' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('accepts a claude-agent comm', () => {
    writeProcess({
      pid: 208,
      comm: 'claude-agent',
      cmdline: argv('claude-agent', '--name', 'secretary'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-g' },
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()[0]).toMatchObject({
      kind: 'bareNameLeader',
      name: 'secretary',
    });
  });

  it('marks a session whose cgroup scope is an aw scope as launched by the workspace preparation script', () => {
    writeProcess({
      pid: 209,
      comm: 'claude',
      cmdline: argv(
        'claude',
        '-p',
        `Take ownership of ${issueUrl} and finish it`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-h' },
      cgroup:
        '/user.slice/user-1000.slice/user@1000.service/aiagents.slice/aw-HiromiShikata-example-1-4005530.scope',
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(
      repository.listHandoverSessions()[0].runsUnderWorkspacePreparationScript,
    ).toBe(true);
  });

  it('does not mark a leader session whose cgroup scope is a cl scope as launched by the workspace preparation script', () => {
    writeProcess({
      pid: 210,
      comm: 'claude',
      cmdline: argv('claude', '--name', 'uminopm'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-i' },
      cgroup:
        '/user.slice/user-1000.slice/user@1000.service/aiagents.slice/cl-uminopm.scope',
    });

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(
      repository.listHandoverSessions()[0].runsUnderWorkspacePreparationScript,
    ).toBe(false);
  });

  it('throws when the proc directory does not exist', () => {
    const repository = new ProcClaudeHandoverSessionRepository(
      path.join(procDirectory, 'does-not-exist'),
    );

    expect(() => repository.listHandoverSessions()).toThrow();
  });

  it('throws when the proc directory is a regular file', () => {
    const filePath = path.join(procDirectory, 'proc-file');
    fs.writeFileSync(filePath, 'not a proc directory');
    const repository = new ProcClaudeHandoverSessionRepository(filePath);

    expect(() => repository.listHandoverSessions()).toThrow();
  });

  it('skips a process whose comm file disappeared after listing', () => {
    fs.mkdirSync(path.join(procDirectory, '211'));
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('skips a process whose cmdline file disappeared after reading comm', () => {
    const processDirectory = path.join(procDirectory, '212');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('skips a process whose environ file disappeared after reading cmdline', () => {
    const processDirectory = path.join(procDirectory, '213');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      argv('claude', '--name', 'app'),
    );
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('skips the process when readComm reports ESRCH', () => {
    const processDirectory = path.join(procDirectory, '214');
    const commPath = path.join(processDirectory, 'comm');
    fs.mkdirSync(processDirectory);
    const error = Object.assign(new Error('read comm ESRCH'), {
      code: 'ESRCH',
    });
    mockReadFileSyncFailureAt(commPath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('rethrows when readComm reports EACCES', () => {
    const processDirectory = path.join(procDirectory, '215');
    const commPath = path.join(processDirectory, 'comm');
    fs.mkdirSync(processDirectory);
    const error = Object.assign(new Error('read comm EACCES'), {
      code: 'EACCES',
    });
    mockReadFileSyncFailureAt(commPath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(error);
  });

  it('skips the process when readCommandArguments reports ESRCH', () => {
    const processDirectory = path.join(procDirectory, '216');
    const cmdlinePath = path.join(processDirectory, 'cmdline');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    const error = Object.assign(new Error('read cmdline ESRCH'), {
      code: 'ESRCH',
    });
    mockReadFileSyncFailureAt(cmdlinePath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('rethrows when readCommandArguments reports EACCES', () => {
    const processDirectory = path.join(procDirectory, '217');
    const cmdlinePath = path.join(processDirectory, 'cmdline');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    const error = Object.assign(new Error('read cmdline EACCES'), {
      code: 'EACCES',
    });
    mockReadFileSyncFailureAt(cmdlinePath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(error);
  });

  it('skips the process when readEnviron reports ESRCH', () => {
    const processDirectory = path.join(procDirectory, '220');
    const environPath = path.join(processDirectory, 'environ');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      argv('claude', '--name', 'app'),
    );
    const error = Object.assign(new Error('read environ ESRCH'), {
      code: 'ESRCH',
    });
    mockReadFileSyncFailureAt(environPath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(repository.listHandoverSessions()).toEqual([]);
  });

  it('rethrows when readEnviron reports EACCES', () => {
    const processDirectory = path.join(procDirectory, '221');
    const environPath = path.join(processDirectory, 'environ');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      argv('claude', '--name', 'app'),
    );
    const error = Object.assign(new Error('read environ EACCES'), {
      code: 'EACCES',
    });
    mockReadFileSyncFailureAt(environPath, error);

    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(error);
  });

  it('rethrows an EISDIR error from readComm', () => {
    const processDirectory = path.join(procDirectory, '217');
    fs.mkdirSync(path.join(processDirectory, 'comm'), { recursive: true });
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(/EISDIR/);
  });

  it('rethrows an EISDIR error from readCommandArguments', () => {
    const processDirectory = path.join(procDirectory, '218');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    fs.mkdirSync(path.join(processDirectory, 'cmdline'));
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(/EISDIR/);
  });

  it('rethrows an EISDIR error from readEnviron', () => {
    const processDirectory = path.join(procDirectory, '219');
    fs.mkdirSync(processDirectory);
    fs.writeFileSync(path.join(processDirectory, 'comm'), 'claude\n');
    fs.writeFileSync(
      path.join(processDirectory, 'cmdline'),
      argv('claude', '--name', 'app'),
    );
    fs.mkdirSync(path.join(processDirectory, 'environ'));
    const repository = new ProcClaudeHandoverSessionRepository(procDirectory);

    expect(() => repository.listHandoverSessions()).toThrow(/EISDIR/);
  });
});
