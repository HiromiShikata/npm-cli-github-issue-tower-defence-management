import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcClaudeLiveSessionRepository } from './ProcClaudeLiveSessionRepository';

type FakeProcess = {
  pid: number;
  cmdline: string;
  environ: Record<string, string>;
};

describe('ProcClaudeLiveSessionRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-'));
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

  const writeNonNumericEntry = (name: string): void => {
    fs.mkdirSync(path.join(procDirectory, name), { recursive: true });
  };

  it('uses the config dir as the session key when present', () => {
    writeProcess({
      pid: 101,
      cmdline: '/home/user/.local/share/claude/cli.js\0--print\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-a',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-a',
        CLAUDE_CODE_SESSION_ID: 'session-a',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([
      { token: 'token-a', sessionKey: '/home/user/.config/claude-a' },
    ]);
  });

  it('falls back to the session id when no config dir is present', () => {
    writeProcess({
      pid: 102,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-b',
        CLAUDE_CODE_SESSION_ID: 'session-b',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([
      { token: 'token-b', sessionKey: 'session-b' },
    ]);
  });

  it('counts a resumed session with an empty session id by its config dir', () => {
    writeProcess({
      pid: 110,
      cmdline: '/home/user/.local/share/claude/cli.js\0--resume\0abc\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-resumed',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-resumed',
        CLAUDE_CODE_SESSION_ID: '',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([
      {
        token: 'token-resumed',
        sessionKey: '/home/user/.config/claude-resumed',
      },
    ]);
  });

  it('returns one entry per process sharing a config dir so the use case can dedupe to one session', () => {
    writeProcess({
      pid: 111,
      cmdline: '/home/user/.local/share/claude/cli.js\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-shared',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-shared',
      },
    });
    writeProcess({
      pid: 112,
      cmdline: '/home/user/.local/share/claude/cli.js\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-shared',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-shared',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([
      { token: 'token-shared', sessionKey: '/home/user/.config/claude-shared' },
      { token: 'token-shared', sessionKey: '/home/user/.config/claude-shared' },
    ]);
  });

  it('ignores a claude process with a token but neither config dir nor session id', () => {
    writeProcess({
      pid: 113,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-no-key',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([]);
  });

  it('ignores a process without an oauth token (for example an api-key session)', () => {
    writeProcess({
      pid: 103,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_SESSION_ID: 'session-c',
        ANTHROPIC_API_KEY: 'api-key',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([]);
  });

  it('ignores a non-claude process that happens to carry the token', () => {
    writeProcess({
      pid: 104,
      cmdline: '/usr/bin/bash\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-d',
        CLAUDE_CODE_SESSION_ID: 'session-d',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([]);
  });

  it('returns one entry per child process sharing a session id so the use case can dedupe', () => {
    writeProcess({
      pid: 105,
      cmdline: '/home/user/.local/share/claude/cli.js\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-e',
        CLAUDE_CODE_SESSION_ID: 'session-e',
      },
    });
    writeProcess({
      pid: 106,
      cmdline: '/home/user/.local/share/claude/cli.js\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-e',
        CLAUDE_CODE_SESSION_ID: 'session-e',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([
      { token: 'token-e', sessionKey: 'session-e' },
      { token: 'token-e', sessionKey: 'session-e' },
    ]);
  });

  it('skips non-numeric proc entries and unreadable processes', () => {
    writeNonNumericEntry('cpuinfo');
    fs.mkdirSync(path.join(procDirectory, '107'), { recursive: true });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    expect(repository.listLiveSessions()).toEqual([]);
  });

  it('returns an empty list when the proc directory does not exist', () => {
    const repository = new ProcClaudeLiveSessionRepository(
      path.join(procDirectory, 'missing'),
    );

    expect(repository.listLiveSessions()).toEqual([]);
  });
});
