import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AwLogIssueLatestSessionBranchRepository } from './AwLogIssueLatestSessionBranchRepository';

const issue = { org: 'user', repo: 'repo', number: 1 };

const writeAwLog = (
  awLogDirectoryPath: string,
  fileName: string,
  workingDirectoryPath: string | null,
): void => {
  const headerLines = [
    'TDPM binary: /opt/tdpm/bin/github-issue-tower-defence-management',
    'Starting task preparation at Fri Sep 25 01:40:58 AM UTC 2026',
    'Work directory: /workspaces/repo',
    ...(workingDirectoryPath === null
      ? []
      : [
          `Reusing existing workspace: ${workingDirectoryPath}`,
          `Current directory: ${workingDirectoryPath}`,
        ]),
    'Request: ultracode Take ownership of https://github.com/user/repo/issues/1',
    '{"type":"system","subtype":"init"}',
  ];
  fs.writeFileSync(
    path.join(awLogDirectoryPath, fileName),
    `${headerLines.join('\n')}\n`,
  );
};

const createLinkedWorktree = (
  rootPath: string,
  worktreeName: string,
  headFileContent: string,
  gitDirectoryPointer: (gitDirectoryPath: string) => string,
): string => {
  const worktreePath = path.join(rootPath, 'worktrees', worktreeName);
  const gitDirectoryPath = path.join(
    rootPath,
    'main',
    '.git',
    'worktrees',
    worktreeName,
  );
  fs.mkdirSync(worktreePath, { recursive: true });
  fs.mkdirSync(gitDirectoryPath, { recursive: true });
  fs.writeFileSync(path.join(gitDirectoryPath, 'HEAD'), headFileContent);
  fs.writeFileSync(
    path.join(worktreePath, '.git'),
    `gitdir: ${gitDirectoryPointer(gitDirectoryPath)}\n`,
  );
  return worktreePath;
};

describe('AwLogIssueLatestSessionBranchRepository', () => {
  let rootPath: string;
  let awLogDirectoryPath: string;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    rootPath = fs.mkdtempSync(path.join(os.tmpdir(), 'aw-log-session-'));
    awLogDirectoryPath = path.join(rootPath, 'logs-aw');
    fs.mkdirSync(awLogDirectoryPath);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    fs.rmSync(rootPath, { recursive: true, force: true });
  });

  it('returns null without reading any file when no aw log directory is configured', async () => {
    const readdirSpy = jest.spyOn(fs.promises, 'readdir');
    const repository = new AwLogIssueLatestSessionBranchRepository(null);

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(readdirSpy).not.toHaveBeenCalled();
    readdirSpy.mockRestore();
  });

  it('returns the branch checked out in the working directory recorded by the newest aw log of the issue', async () => {
    const earlierWorktreePath = createLinkedWorktree(
      rootPath,
      'i1',
      'ref: refs/heads/i1\n',
      (gitDirectoryPath) => gitDirectoryPath,
    );
    const latestWorktreePath = createLinkedWorktree(
      rootPath,
      'impl-i1-feature',
      'ref: refs/heads/impl-i1-feature\n',
      (gitDirectoryPath) => gitDirectoryPath,
    );
    const otherIssueWorktreePath = createLinkedWorktree(
      rootPath,
      'i11',
      'ref: refs/heads/i11\n',
      (gitDirectoryPath) => gitDirectoryPath,
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_010322.log',
      earlierWorktreePath,
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      latestWorktreePath,
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_11_20260925_020000.log',
      otherIssueWorktreePath,
    );
    writeAwLog(
      awLogDirectoryPath,
      'other_repo_1_20260925_030000.log',
      otherIssueWorktreePath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBe('impl-i1-feature');
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('resolves a gitdir pointer written relative to the working directory', async () => {
    const worktreePath = createLinkedWorktree(
      rootPath,
      'impl-i1-relative',
      'ref: refs/heads/impl/i1-relative\n',
      (gitDirectoryPath) =>
        path.relative(
          path.join(rootPath, 'worktrees', 'impl-i1-relative'),
          gitDirectoryPath,
        ),
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      worktreePath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBe('impl/i1-relative');
  });

  it('reads the branch from a working directory whose .git is a directory', async () => {
    const workingDirectoryPath = path.join(rootPath, 'main-checkout');
    fs.mkdirSync(path.join(workingDirectoryPath, '.git'), { recursive: true });
    fs.writeFileSync(
      path.join(workingDirectoryPath, '.git', 'HEAD'),
      'ref: refs/heads/i1\n',
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      workingDirectoryPath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBe('i1');
  });

  it('returns null without a warning when the issue has no aw log yet', async () => {
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_11_20260925_020000.log',
      path.join(rootPath, 'worktrees', 'i11'),
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('returns null with the directory path in a warning when the aw log directory cannot be read', async () => {
    const missingDirectoryPath = path.join(rootPath, 'missing-logs-aw');
    const repository = new AwLogIssueLatestSessionBranchRepository(
      missingDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(missingDirectoryPath),
    );
  });

  it('returns null with the log path in a warning when the newest aw log records no working directory', async () => {
    writeAwLog(awLogDirectoryPath, 'user_repo_1_20260925_014058.log', null);
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        path.join(awLogDirectoryPath, 'user_repo_1_20260925_014058.log'),
      ),
    );
  });

  it('returns null with the working directory path in a warning when the recorded working directory no longer exists', async () => {
    const removedWorktreePath = path.join(rootPath, 'worktrees', 'removed');
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      removedWorktreePath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(removedWorktreePath),
    );
  });

  it('returns null with the log path in a warning when the newest aw log cannot be read', async () => {
    const unreadableAwLogPath = path.join(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
    );
    fs.mkdirSync(unreadableAwLogPath);
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(unreadableAwLogPath),
    );
  });

  it('returns null with the working directory path in a warning when its .git file carries no gitdir pointer', async () => {
    const workingDirectoryPath = path.join(rootPath, 'broken-worktree');
    fs.mkdirSync(workingDirectoryPath);
    fs.writeFileSync(
      path.join(workingDirectoryPath, '.git'),
      'not a pointer\n',
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      workingDirectoryPath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(workingDirectoryPath),
    );
  });

  it('returns null when the recorded working directory has a detached HEAD', async () => {
    const worktreePath = createLinkedWorktree(
      rootPath,
      'detached',
      'c11243f19b359755afc8266c6b479f54ce636fa3\n',
      (gitDirectoryPath) => gitDirectoryPath,
    );
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      worktreePath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBeNull();
  });

  it('returns the branch of a linked worktree that git itself created', async () => {
    const mainRepositoryPath = path.join(rootPath, 'git-main');
    const worktreePath = path.join(rootPath, 'git-worktrees', 'impl-i1');
    fs.mkdirSync(mainRepositoryPath);
    const runGit = (workingDirectoryPath: string, args: string[]): void => {
      execFileSync('git', args, {
        cwd: workingDirectoryPath,
        stdio: 'ignore',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 'test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
        },
      });
    };
    runGit(mainRepositoryPath, ['init', '--quiet', '--initial-branch=main']);
    runGit(mainRepositoryPath, [
      'commit',
      '--quiet',
      '--allow-empty',
      '--message',
      'initial',
    ]);
    runGit(mainRepositoryPath, [
      'worktree',
      'add',
      '--quiet',
      '-b',
      'impl/i1-feature',
      worktreePath,
    ]);
    writeAwLog(
      awLogDirectoryPath,
      'user_repo_1_20260925_014058.log',
      worktreePath,
    );
    const repository = new AwLogIssueLatestSessionBranchRepository(
      awLogDirectoryPath,
    );

    const branchName = await repository.findBranchNameByIssue(issue);

    expect(branchName).toBe('impl/i1-feature');
  });
});
