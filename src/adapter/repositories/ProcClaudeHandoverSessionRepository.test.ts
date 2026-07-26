import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcClaudeHandoverSessionRepository } from './ProcClaudeHandoverSessionRepository';

type FakeProcess = {
  pid: number;
  comm: string;
  cmdline: string;
  environ: Record<string, string>;
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

  it('returns an empty list when the proc directory cannot be read', () => {
    const repository = new ProcClaudeHandoverSessionRepository(
      path.join(procDirectory, 'does-not-exist'),
    );

    expect(repository.listHandoverSessions()).toEqual([]);
  });
});
