import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { TakeOwnershipSpawn } from '../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { ProcTakeOwnershipSpawnRepository } from './ProcTakeOwnershipSpawnRepository';

type FakeProcess = {
  pid: number;
  cmdline: string;
  environ: Record<string, string>;
  stat?: { parentPid: number; comm: string };
};

const issueUrl = 'https://github.com/HiromiShikata/example/issues/1';
const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;

describe('ProcTakeOwnershipSpawnRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-spawn-'));
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
    const environBuffer = Object.entries(fakeProcess.environ)
      .map(([key, value]) => `${key}=${value}\0`)
      .join('');
    fs.writeFileSync(path.join(processDirectory, 'environ'), environBuffer);
    if (fakeProcess.stat !== undefined) {
      fs.writeFileSync(
        path.join(processDirectory, 'stat'),
        `${fakeProcess.pid} (${fakeProcess.stat.comm}) S ${fakeProcess.stat.parentPid} ${fakeProcess.pid} ${fakeProcess.pid} 0 -1 4194304`,
      );
    }
  };

  const wrapperCommandLine = (logName: string): string =>
    argv(
      'bash',
      '-c',
      `timeout 3h claude-agent -p "Take ownership of ${issueUrl}" | tee /home/user/logs-aw/${logName}.log`,
    );

  const writeWorkerTree = (tree: {
    wrapperPid: number;
    wrapperToken: string;
    logName: string;
    claudeToken: string | null;
  }): void => {
    writeProcess({
      pid: tree.wrapperPid,
      cmdline: wrapperCommandLine(tree.logName),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.wrapperToken },
      stat: { parentPid: 1, comm: 'bash' },
    });
    writeProcess({
      pid: tree.wrapperPid + 1,
      cmdline: wrapperCommandLine(tree.logName),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.wrapperToken },
      stat: { parentPid: tree.wrapperPid, comm: 'bash' },
    });
    if (tree.claudeToken === null) {
      return;
    }
    writeProcess({
      pid: tree.wrapperPid + 2,
      cmdline: argv(
        'timeout',
        '--kill-after=60s',
        '3h',
        'claude-agent',
        '-p',
        `Take ownership of ${issueUrl}`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
      stat: { parentPid: tree.wrapperPid, comm: 'timeout' },
    });
    writeProcess({
      pid: tree.wrapperPid + 3,
      cmdline: argv('claude-agent', '-p', `Take ownership of ${issueUrl}`),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
      stat: { parentPid: tree.wrapperPid + 2, comm: 'claude-agent' },
    });
    writeProcess({
      pid: tree.wrapperPid + 4,
      cmdline: argv(
        'claude',
        '--verbose',
        '-p',
        `Take ownership of ${issueUrl}`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: tree.claudeToken },
      stat: { parentPid: tree.wrapperPid + 3, comm: 'claude' },
    });
  };

  const sortSpawns = (spawns: TakeOwnershipSpawn[]): TakeOwnershipSpawn[] =>
    [...spawns].sort((left, right) =>
      `${left.logPath}\0${left.token}`.localeCompare(
        `${right.logPath}\0${right.token}`,
      ),
    );

  it('reports the token of the claude descendant when the worker wrapper and its claude child hold different tokens', () => {
    writeWorkerTree({
      wrapperPid: 310,
      wrapperToken: 'wrapper-token',
      logName: 'worker-a',
      claudeToken: 'claude-token',
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([
      { token: 'claude-token', logPath: '/logs-aw/worker-a.log' },
      { token: 'claude-token', logPath: '/logs-aw/worker-a.log' },
    ]);
  });

  it('reports the wrapper token when the worker wrapper has no claude descendant yet', () => {
    writeWorkerTree({
      wrapperPid: 320,
      wrapperToken: 'wrapper-token',
      logName: 'worker-b',
      claudeToken: null,
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([
      { token: 'wrapper-token', logPath: '/logs-aw/worker-b.log' },
      { token: 'wrapper-token', logPath: '/logs-aw/worker-b.log' },
    ]);
  });

  it('reports each worker on the shared token when two worker wrappers have claude children on the same token', () => {
    writeWorkerTree({
      wrapperPid: 330,
      wrapperToken: 'wrapper-token-1',
      logName: 'worker-c',
      claudeToken: 'shared-claude-token',
    });
    writeWorkerTree({
      wrapperPid: 340,
      wrapperToken: 'wrapper-token-2',
      logName: 'worker-d',
      claudeToken: 'shared-claude-token',
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(sortSpawns(repository.listSpawns())).toEqual([
      { token: 'shared-claude-token', logPath: '/logs-aw/worker-c.log' },
      { token: 'shared-claude-token', logPath: '/logs-aw/worker-c.log' },
      { token: 'shared-claude-token', logPath: '/logs-aw/worker-d.log' },
      { token: 'shared-claude-token', logPath: '/logs-aw/worker-d.log' },
    ]);
  });

  it('reads the token and log path of a Take ownership spawn', () => {
    writeProcess({
      pid: 301,
      cmdline: argv(
        'bash',
        '-c',
        `claude-agent -p "Take ownership of ${issueUrl}" | tee /home/user/logs-aw/20260626_120000_abc.log`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-a' },
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([
      { token: 'token-a', logPath: '/logs-aw/20260626_120000_abc.log' },
    ]);
  });

  it('ignores a process that is not a Take ownership spawn', () => {
    writeProcess({
      pid: 302,
      cmdline: argv('claude', '--name', issueUrl),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-b' },
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([]);
  });

  it('ignores a Take ownership process whose cmdline carries no log path', () => {
    writeProcess({
      pid: 303,
      cmdline: argv('claude-agent', '-p', `Take ownership of ${issueUrl}`),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-c' },
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([]);
  });

  it('ignores a Take ownership process without an oauth token', () => {
    writeProcess({
      pid: 304,
      cmdline: argv(
        'bash',
        '-c',
        `Take ownership of ${issueUrl} | tee /home/user/logs-aw/x.log`,
      ),
      environ: { ANTHROPIC_API_KEY: 'api-key' },
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([]);
  });

  it('returns one entry per child process so the use case can dedupe by log path', () => {
    const fullLogPath = '/home/user/logs-aw/20260626_120000_dup.log';
    const capturedLogPath = '/logs-aw/20260626_120000_dup.log';
    writeProcess({
      pid: 305,
      cmdline: argv(
        'bash',
        '-c',
        `Take ownership of ${issueUrl} | tee ${fullLogPath}`,
      ),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-d' },
    });
    writeProcess({
      pid: 306,
      cmdline: argv('tee', fullLogPath, 'Take ownership marker'),
      environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-d' },
    });

    const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

    expect(repository.listSpawns()).toEqual([
      { token: 'token-d', logPath: capturedLogPath },
      { token: 'token-d', logPath: capturedLogPath },
    ]);
  });

  it('returns an empty list when the proc directory does not exist', () => {
    const repository = new ProcTakeOwnershipSpawnRepository(
      path.join(procDirectory, 'missing'),
    );

    expect(repository.listSpawns()).toEqual([]);
  });

  describe('listRunningIssueUrls', () => {
    it('extracts issue URL from a bash-c style Take ownership spawn', () => {
      writeProcess({
        pid: 401,
        cmdline: argv(
          'bash',
          '-c',
          `claude-agent -p "Take ownership of ${issueUrl}" | tee /home/user/logs-aw/20260626_120000_abc.log`,
        ),
        environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-a' },
      });

      const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

      expect(repository.listRunningIssueUrls()).toEqual([issueUrl]);
    });

    it('extracts issue URL from a null-separated claude-agent spawn', () => {
      writeProcess({
        pid: 402,
        cmdline: argv(
          'timeout',
          '--kill-after=60s',
          '3h',
          'claude-agent',
          '--agent',
          'impl',
          '-p',
          `Take ownership of ${issueUrl} and finish it`,
          '--model',
          'claude-sonnet-4-6',
        ),
        environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-b' },
      });

      const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

      expect(repository.listRunningIssueUrls()).toEqual([issueUrl]);
    });

    it('returns empty list when no Take ownership process is running', () => {
      writeProcess({
        pid: 403,
        cmdline: argv('claude', '--name', issueUrl),
        environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-c' },
      });

      const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

      expect(repository.listRunningIssueUrls()).toEqual([]);
    });

    it('returns URLs from all matching processes', () => {
      const issueUrl2 = 'https://github.com/HiromiShikata/example/issues/2';
      writeProcess({
        pid: 404,
        cmdline: argv(
          'timeout',
          '--kill-after=60s',
          '3h',
          'claude-agent',
          '--agent',
          'impl',
          '-p',
          `Take ownership of ${issueUrl} and finish it`,
          '--model',
          'claude-sonnet-4-6',
        ),
        environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-d' },
      });
      writeProcess({
        pid: 405,
        cmdline: argv(
          'timeout',
          '--kill-after=60s',
          '3h',
          'claude-agent',
          '--agent',
          'impl',
          '-p',
          `Take ownership of ${issueUrl2} and finish it`,
          '--model',
          'claude-sonnet-4-6',
        ),
        environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-e' },
      });

      const repository = new ProcTakeOwnershipSpawnRepository(procDirectory);

      expect(repository.listRunningIssueUrls()).toEqual([issueUrl, issueUrl2]);
    });

    it('returns empty list when the proc directory does not exist', () => {
      const repository = new ProcTakeOwnershipSpawnRepository(
        path.join(procDirectory, 'missing'),
      );

      expect(repository.listRunningIssueUrls()).toEqual([]);
    });
  });
});
