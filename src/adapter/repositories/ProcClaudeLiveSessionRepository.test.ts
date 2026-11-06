import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isDeepStrictEqual } from 'util';
import { ClaudeLiveSession } from '../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
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

  it('keys each claude process with a token but neither config dir nor session id by its process id', () => {
    writeProcess({
      pid: 113,
      cmdline: '/usr/local/bin/claude\0-p\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-no-key',
      },
    });
    writeProcess({
      pid: 114,
      cmdline: '/home/user/.local/share/claude/versions/2.1.0\0-p\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-no-key',
        CLAUDE_CONFIG_DIR: '',
        CLAUDE_CODE_SESSION_ID: '',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);

    const liveSessions = [...repository.listLiveSessions()].sort(
      (left, right) => left.sessionKey.localeCompare(right.sessionKey),
    );
    expect(liveSessions).toEqual([
      { token: 'token-no-key', sessionKey: 'pid:113' },
      { token: 'token-no-key', sessionKey: 'pid:114' },
    ]);
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

  it('pins local claude detection and session key derivation across all cases', () => {
    type ProcessFixture = {
      pid: number;
      cmdline?: string;
      exe?: string;
      environ: Record<string, string>;
    };
    type PinningCase = {
      name: string;
      directory: 'present' | 'missing' | 'unreadable';
      processes: ProcessFixture[];
      expected: ClaudeLiveSession[];
    };
    const claudeExe = '/home/user/.local/share/claude/versions/2.1.0';
    const cases: PinningCase[] = [
      {
        name: 'claude process keys by config dir when present',
        directory: 'present',
        processes: [
          {
            pid: 201,
            cmdline: 'claude\0--print\0',
            environ: {
              CLAUDE_CODE_OAUTH_TOKEN: 'token-pin-a',
              CLAUDE_CONFIG_DIR: '/home/user/.config/pin-a',
              CLAUDE_CODE_SESSION_ID: 'session-pin-a',
            },
          },
        ],
        expected: [
          { token: 'token-pin-a', sessionKey: '/home/user/.config/pin-a' },
        ],
      },
      {
        name: 'claude process keys by session id without config dir',
        directory: 'present',
        processes: [
          {
            pid: 202,
            cmdline: 'claude\0',
            environ: {
              CLAUDE_CODE_OAUTH_TOKEN: 'token-pin-b',
              CLAUDE_CODE_SESSION_ID: 'session-pin-b',
            },
          },
        ],
        expected: [{ token: 'token-pin-b', sessionKey: 'session-pin-b' }],
      },
      {
        name: 'claude process keys by pid without config dir or session id',
        directory: 'present',
        processes: [
          {
            pid: 203,
            cmdline: 'claude\0',
            environ: { CLAUDE_CODE_OAUTH_TOKEN: 'token-pin-c' },
          },
        ],
        expected: [{ token: 'token-pin-c', sessionKey: 'pid:203' }],
      },
      {
        name: 'non-claude process with token and no marker is not counted',
        directory: 'present',
        processes: [
          {
            pid: 204,
            cmdline: 'ssh\0example-host\0',
            environ: {
              CLAUDE_CODE_OAUTH_TOKEN: 'token-pin-d',
              CLAUDE_CODE_SESSION_ID: 'session-pin-d',
            },
          },
        ],
        expected: [],
      },
      {
        name: 'claude process without token is not counted',
        directory: 'present',
        processes: [
          {
            pid: 205,
            cmdline: 'claude\0',
            environ: { CLAUDE_CODE_SESSION_ID: 'session-pin-e' },
          },
        ],
        expected: [],
      },
      {
        name: 'claude process with empty token is not counted',
        directory: 'present',
        processes: [
          {
            pid: 206,
            cmdline: 'claude\0',
            environ: {
              CLAUDE_CODE_OAUTH_TOKEN: '',
              CLAUDE_CONFIG_DIR: '/home/user/.config/pin-f',
            },
          },
        ],
        expected: [],
      },
      {
        name: 'process detected only by exe symlink is counted by config dir',
        directory: 'present',
        processes: [
          {
            pid: 207,
            cmdline: 'node\0/opt/app.js\0',
            exe: claudeExe,
            environ: {
              CLAUDE_CODE_OAUTH_TOKEN: 'token-pin-g1',
              CLAUDE_CONFIG_DIR: '/home/user/.config/pin-g1',
            },
          },
        ],
        expected: [
          { token: 'token-pin-g1', sessionKey: '/home/user/.config/pin-g1' },
        ],
      },
      {
        name: 'missing proc directory yields no sessions',
        directory: 'missing',
        processes: [],
        expected: [],
      },
      {
        name: 'unreadable proc directory yields no sessions',
        directory: 'unreadable',
        processes: [],
        expected: [],
      },
    ];

    const writeFixtureProcess = (root: string, fixture: ProcessFixture) => {
      const processDirectory = path.join(root, String(fixture.pid));
      fs.mkdirSync(processDirectory, { recursive: true });
      if (fixture.cmdline !== undefined) {
        fs.writeFileSync(
          path.join(processDirectory, 'cmdline'),
          fixture.cmdline,
        );
      }
      if (fixture.exe !== undefined) {
        fs.symlinkSync(fixture.exe, path.join(processDirectory, 'exe'));
      }
      const environBuffer = Object.entries(fixture.environ)
        .map(([key, value]) => `${key}=${value}\0`)
        .join('');
      fs.writeFileSync(path.join(processDirectory, 'environ'), environBuffer);
    };

    const mismatches: {
      name: string;
      actual: ClaudeLiveSession[];
      expected: ClaudeLiveSession[];
    }[] = [];
    cases.forEach((testCase, index) => {
      const caseDirectory = path.join(procDirectory, `case-${index}`);
      fs.mkdirSync(caseDirectory);
      for (const fixture of testCase.processes) {
        writeFixtureProcess(caseDirectory, fixture);
      }
      if (testCase.directory === 'unreadable') {
        fs.chmodSync(caseDirectory, 0o000);
      }
      const repositoryDirectory =
        testCase.directory === 'missing'
          ? path.join(caseDirectory, 'missing')
          : caseDirectory;
      const actual = new ProcClaudeLiveSessionRepository(
        repositoryDirectory,
      ).listLiveSessions();
      if (testCase.directory === 'unreadable') {
        fs.chmodSync(caseDirectory, 0o755);
      }
      if (!isDeepStrictEqual(actual, testCase.expected)) {
        mismatches.push({
          name: testCase.name,
          actual,
          expected: testCase.expected,
        });
      }
    });

    expect(mismatches).toEqual([]);
  });
});
