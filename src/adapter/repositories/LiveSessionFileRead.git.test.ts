import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SessionCommandRepository,
  SessionHost,
  SessionReadCommand,
  SessionReadCommandResult,
} from '../../domain/usecases/adapter-interfaces/LiveSessionToolRepository';
import { LiveSessionToolCallUseCase } from '../../domain/usecases/liveSession/LiveSessionToolCallUseCase';
import { TmuxSshSessionCommandRepository } from './TmuxSshSessionCommandRepository';

const SESSION_NAME = 'live-tools-file-read-test';

class TmuxFakeSessionCommands implements SessionCommandRepository {
  private readonly realCommands = new TmuxSshSessionCommandRepository();

  constructor(private readonly folder: string) {}

  run = (
    host: SessionHost,
    command: SessionReadCommand,
  ): Promise<SessionReadCommandResult> => {
    if (command.kind === 'tmuxHasSession') {
      return Promise.resolve({ kind: 'exited', exitCode: 0, stdout: '' });
    }
    if (command.kind === 'tmuxPanePath') {
      return Promise.resolve({
        kind: 'exited',
        exitCode: 0,
        stdout: `${this.folder}\n`,
      });
    }
    return this.realCommands.run(host, command);
  };
}

const useCaseFor = (folder: string): LiveSessionToolCallUseCase =>
  new LiveSessionToolCallUseCase({
    localHomeDirectory: os.homedir(),
    knownIssueUrls: { listKnownIssueUrls: () => [] },
    ownerCalls: { listPendingOwnerCalls: () => [] },
    hosts: { findHostOfIssueSession: () => ({ kind: 'local' }) },
    commands: new TmuxFakeSessionCommands(folder),
    issues: {
      getIssueByUrl: () => Promise.reject(new Error('unused')),
      getIssueOrPullRequestBody: () => Promise.reject(new Error('unused')),
      getIssueOrPullRequestComments: () => Promise.reject(new Error('unused')),
    },
  });

const readPath = async (
  folder: string,
  relativePath: string,
): Promise<string> => {
  const outcome = await useCaseFor(folder).run({
    name: 'session_file_read',
    arguments: { path: relativePath },
    sessionName: SESSION_NAME,
  });
  if (outcome.kind !== 'output') {
    throw new Error(`unexpected outcome ${outcome.kind}`);
  }
  return outcome.output;
};

const CREDENTIAL_TEXT =
  '認証情報と見なされるファイルまたはフォルダのため、読めません。';
const UNTRACKED_TEXT =
  'Git で管理されていないファイルまたはフォルダのため、読めません。';
const OUTSIDE_TEXT =
  '指定されたパスはセッションの作業フォルダの外にあるため、読めません。';
const NOT_IN_WORK_TREE_TEXT =
  'Git の作業ツリーの中にないフォルダのファイルは読めません。';
const HOME_TEXT =
  'ホームディレクトリ、またはその上位のフォルダは作業フォルダとして読めません。';

describe('session_file_read against real git work trees', () => {
  let root: string;
  let repo: string;

  const writeFile = (relative: string, content: string): void => {
    const target = path.join(repo, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };

  const trackFiles = (...relatives: string[]): void => {
    execFileSync('git', ['-C', repo, 'add', '--', ...relatives]);
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'file-read-git-test-'));
    repo = path.join(root, 'repo');
    fs.mkdirSync(repo);
    execFileSync('git', ['-C', repo, 'init', '-q']);
    writeFile('README.md', 'tracked readme\n');
    writeFile('.dockerignore', 'node_modules\n');
    writeFile('.azure-pipelines.yml', 'steps: []\n');
    writeFile('.env', 'TOKEN=example\n');
    writeFile('notes.txt', 'untracked notes\n');
    writeFile('keys/server.PEM', 'PEM example\n');
    trackFiles(
      'README.md',
      '.dockerignore',
      '.azure-pipelines.yml',
      '.env',
      'keys/server.PEM',
    );
    writeFile('.env.local', 'LOCAL=example\n');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('reads tracked files, including the ordinary dotfiles', async () => {
    expect(await readPath(repo, 'README.md')).toBe('tracked readme\n');
    expect(await readPath(repo, '.dockerignore')).toBe('node_modules\n');
    expect(await readPath(repo, '.azure-pipelines.yml')).toBe('steps: []\n');
  });

  it('refuses an untracked ordinary file', async () => {
    expect(await readPath(repo, 'notes.txt')).toBe(UNTRACKED_TEXT);
  });

  it('refuses an untracked dotenv file', async () => {
    expect(await readPath(repo, '.env.local')).toBe(CREDENTIAL_TEXT);
  });

  it('refuses a tracked credential-like key file', async () => {
    expect(await readPath(repo, 'keys/server.PEM')).toBe(CREDENTIAL_TEXT);
  });

  it('refuses a tracked dotenv file', async () => {
    expect(await readPath(repo, '.env')).toBe(CREDENTIAL_TEXT);
  });

  it('refuses reading anything under the git metadata folder', async () => {
    expect(await readPath(repo, '.git/config')).toBe(CREDENTIAL_TEXT);
  });

  it('lists only tracked, non-denied entries of the folder', async () => {
    expect(await readPath(repo, '.')).toBe(
      '.azure-pipelines.yml\n.dockerignore\nREADME.md\nkeys/',
    );
  });

  it('lists a subfolder with its tracked files only', async () => {
    expect(await readPath(repo, 'keys')).toBe('');
  });

  it('refuses a symlink that escapes the folder', async () => {
    const outside = path.join(root, 'outside.txt');
    fs.writeFileSync(outside, 'outside\n');
    fs.symlinkSync(outside, path.join(repo, 'escape-link'));
    trackFiles('escape-link');
    expect(await readPath(repo, 'escape-link')).toBe(OUTSIDE_TEXT);
  });

  it('reads a symlink that stays inside the folder and points to a tracked file', async () => {
    fs.symlinkSync(
      path.join(repo, 'README.md'),
      path.join(repo, 'readme-link.md'),
    );
    trackFiles('readme-link.md');
    expect(await readPath(repo, 'readme-link.md')).toBe('tracked readme\n');
  });

  it('refuses a folder that is not inside a git work tree', async () => {
    const plain = path.join(root, 'plain');
    fs.mkdirSync(plain);
    fs.writeFileSync(path.join(plain, 'a.txt'), 'plain\n');
    expect(await readPath(plain, 'a.txt')).toBe(NOT_IN_WORK_TREE_TEXT);
  });

  it('refuses a work tree whose folder sits under a credential folder', async () => {
    const credentialRepo = path.join(root, '.aws', 'project');
    fs.mkdirSync(credentialRepo, { recursive: true });
    execFileSync('git', ['-C', credentialRepo, 'init', '-q']);
    fs.writeFileSync(path.join(credentialRepo, 'README.md'), 'readme\n');
    execFileSync('git', ['-C', credentialRepo, 'add', '--', 'README.md']);
    expect(await readPath(credentialRepo, 'README.md')).toBe(CREDENTIAL_TEXT);
  });

  it('refuses the home folder as the working folder', async () => {
    expect(await readPath(os.homedir(), '.')).toBe(HOME_TEXT);
  });
});
