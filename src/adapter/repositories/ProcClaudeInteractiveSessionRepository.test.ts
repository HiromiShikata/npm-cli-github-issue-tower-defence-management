import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcClaudeInteractiveSessionRepository } from './ProcClaudeInteractiveSessionRepository';

type FakeProcess = {
  pid: number;
  cmdline: string;
  environ: Record<string, string>;
};

const issueUrl = 'https://github.com/HiromiShikata/example/issues/1';

const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;

describe('ProcClaudeInteractiveSessionRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-int-'));
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
  };

  it('reads token, session id and issue url from a cl-launched interactive process', () => {
    writeProcess({
      pid: 201,
      cmdline: argv('claude', '--model', 'opus', '--name', issueUrl),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-a',
        CLAUDE_CODE_SESSION_ID: 'session-a',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([
      { token: 'token-a', sessionId: 'session-a', issueUrl },
    ]);
  });

  it('ignores a process without a --name issue url argument', () => {
    writeProcess({
      pid: 202,
      cmdline: argv('claude', '--model', 'opus'),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-b',
        CLAUDE_CODE_SESSION_ID: 'session-b',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });

  it('excludes a Take ownership aw spawn even when it carries the token', () => {
    writeProcess({
      pid: 203,
      cmdline: argv(
        'claude-agent',
        '--agent',
        'impl',
        '-p',
        `Take ownership of ${issueUrl} and finish it`,
      ),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-c',
        CLAUDE_CODE_SESSION_ID: 'session-c',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });

  it('ignores a --name process without an oauth token', () => {
    writeProcess({
      pid: 204,
      cmdline: argv('claude', '--name', issueUrl),
      environ: {
        CLAUDE_CODE_SESSION_ID: 'session-d',
        ANTHROPIC_API_KEY: 'api-key',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });

  it('ignores a --name process without a session id', () => {
    writeProcess({
      pid: 205,
      cmdline: argv('claude', '--name', issueUrl),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-e',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });

  it('ignores a --name value that is not an http url', () => {
    writeProcess({
      pid: 206,
      cmdline: argv('claude', '--name', 'just-a-label'),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-f',
        CLAUDE_CODE_SESSION_ID: 'session-f',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });

  it('returns one entry per child process so the use case can dedupe by session id', () => {
    writeProcess({
      pid: 207,
      cmdline: argv('claude', '--name', issueUrl),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-g',
        CLAUDE_CODE_SESSION_ID: 'session-g',
      },
    });
    writeProcess({
      pid: 208,
      cmdline: argv('claude', '--name', issueUrl),
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-g',
        CLAUDE_CODE_SESSION_ID: 'session-g',
      },
    });

    const repository = new ProcClaudeInteractiveSessionRepository(
      procDirectory,
    );

    expect(repository.listInteractiveSessions()).toEqual([
      { token: 'token-g', sessionId: 'session-g', issueUrl },
      { token: 'token-g', sessionId: 'session-g', issueUrl },
    ]);
  });

  it('returns an empty list when the proc directory does not exist', () => {
    const repository = new ProcClaudeInteractiveSessionRepository(
      path.join(procDirectory, 'missing'),
    );

    expect(repository.listInteractiveSessions()).toEqual([]);
  });
});
