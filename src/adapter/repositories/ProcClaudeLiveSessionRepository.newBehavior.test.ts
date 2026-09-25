/**
 * Acceptance tests for SC-4: processes without CLAUDE_CONFIG_DIR or
 * CLAUDE_CODE_SESSION_ID are listed with "pid:<pid>" as the session key.
 *
 * These tests MUST FAIL against the current implementation.
 *
 * R1 (regression): processes that DO have CLAUDE_CONFIG_DIR continue to use
 * the config dir path as the session key (not "pid:<pid>").
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcClaudeLiveSessionRepository } from './ProcClaudeLiveSessionRepository';

type FakeProcess = {
  pid: number;
  cmdline: string;
  environ: Record<string, string>;
};

describe('SC-4: process without CLAUDE_CONFIG_DIR or SESSION_ID is listed with pid key', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-sc4-'));
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

  it('lists a process with an oauth token but neither CLAUDE_CONFIG_DIR nor CLAUDE_CODE_SESSION_ID using pid:<pid> as its session key', () => {
    /**
     * Current behavior: returns [] (the process is ignored).
     * New behavior:     returns [{ token, sessionKey: 'pid:12345' }].
     */
    const pid = 12345;
    writeProcess({
      pid,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-pid-only',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);
    const sessions = repository.listLiveSessions();

    expect(sessions).toEqual([
      { token: 'token-pid-only', sessionKey: `pid:${pid}` },
    ]);
  });

  it('still ignores a claude process that carries no oauth token at all', () => {
    writeProcess({
      pid: 99001,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_SESSION_ID: 'some-session',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);
    expect(repository.listLiveSessions()).toEqual([]);
  });
});

describe('R1 (regression): process with CLAUDE_CONFIG_DIR keeps config-dir-based session key', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-proc-r1-'));
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

  it('uses CLAUDE_CONFIG_DIR as session key when both CLAUDE_CONFIG_DIR and CLAUDE_CODE_SESSION_ID are present', () => {
    writeProcess({
      pid: 201,
      cmdline: '/home/user/.local/share/claude/cli.js\0--print\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-session-key',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-session',
        CLAUDE_CODE_SESSION_ID: 'some-session-id',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);
    const sessions = repository.listLiveSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionKey).toBe('/home/user/.config/claude-session');
    expect(sessions[0]?.sessionKey).not.toMatch(/^pid:/);
  });

  it('uses CLAUDE_CONFIG_DIR as session key even when CLAUDE_CODE_SESSION_ID is absent', () => {
    writeProcess({
      pid: 202,
      cmdline: '/usr/local/bin/claude\0',
      environ: {
        CLAUDE_CODE_OAUTH_TOKEN: 'token-config-only',
        CLAUDE_CONFIG_DIR: '/home/user/.config/claude-config-only',
      },
    });

    const repository = new ProcClaudeLiveSessionRepository(procDirectory);
    const sessions = repository.listLiveSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sessionKey).toBe(
      '/home/user/.config/claude-config-only',
    );
    expect(sessions[0]?.sessionKey).not.toMatch(/^pid:/);
  });
});
