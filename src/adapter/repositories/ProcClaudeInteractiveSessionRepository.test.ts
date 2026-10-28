import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ProcClaudeInteractiveSessionRepository,
  extractIssueUrl,
} from './ProcClaudeInteractiveSessionRepository';

type FakeProcess = {
  pid: number;
  cmdline: string;
  environ: Record<string, string>;
};

const issueUrl = 'https://github.com/HiromiShikata/example/issues/1';
const pullRequestUrl = 'https://github.com/HiromiShikata/example/pull/2';

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

  it('returns the leading GitHub issue or pull request url of the --name argument value, ignoring any text after the number, and leaves any other value unchanged', () => {
    const testCases: {
      name: string;
      commandArguments: string[];
      expectedIssueUrl: string | null;
    }[] = [
      {
        name: 'plain issue url',
        commandArguments: ['claude', '--name', issueUrl],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'one title suffix after the issue url',
        commandArguments: ['claude', '--name', `${issueUrl}/title-suffix`],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'another title suffix after the issue url',
        commandArguments: ['claude', '--name', `${issueUrl}/another-suffix`],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'one title suffix repeated twice',
        commandArguments: [
          'claude',
          '--name',
          `${issueUrl}/title-suffix/title-suffix`,
        ],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'one title suffix repeated six times',
        commandArguments: [
          'claude',
          '--name',
          `${issueUrl}${'/title-suffix'.repeat(6)}`,
        ],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'text directly after the issue number',
        commandArguments: ['claude', '--name', `${issueUrl}-extra`],
        expectedIssueUrl: issueUrl,
      },
      {
        name: 'plain pull request url',
        commandArguments: ['claude', '--name', pullRequestUrl],
        expectedIssueUrl: pullRequestUrl,
      },
      {
        name: 'one title suffix after the pull request url',
        commandArguments: [
          'claude',
          '--name',
          `${pullRequestUrl}/title-suffix`,
        ],
        expectedIssueUrl: pullRequestUrl,
      },
      {
        name: 'text directly after the pull request number',
        commandArguments: ['claude', '--name', `${pullRequestUrl}-extra`],
        expectedIssueUrl: pullRequestUrl,
      },
      {
        name: 'non-GitHub https url is returned unchanged',
        commandArguments: [
          'claude',
          '--name',
          'https://example.com/owner/repo/issues/1/title-suffix',
        ],
        expectedIssueUrl:
          'https://example.com/owner/repo/issues/1/title-suffix',
      },
      {
        name: 'not a url',
        commandArguments: ['claude', '--name', 'just-a-label'],
        expectedIssueUrl: null,
      },
      {
        name: 'no --name argument present',
        commandArguments: ['claude'],
        expectedIssueUrl: null,
      },
    ];

    expect(
      testCases.map((testCase) => ({
        name: testCase.name,
        issueUrl: extractIssueUrl(testCase.commandArguments),
      })),
    ).toEqual(
      testCases.map((testCase) => ({
        name: testCase.name,
        issueUrl: testCase.expectedIssueUrl,
      })),
    );
  });
});
