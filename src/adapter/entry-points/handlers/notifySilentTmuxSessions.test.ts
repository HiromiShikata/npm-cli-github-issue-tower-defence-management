import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { IN_TMUX_STATUS_NAME } from '../../../domain/entities/WorkflowStatus';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { notifySilentTmuxSessions } from './notifySilentTmuxSessions';

const NOW = new Date('2026-06-26T00:00:00.000Z');
const NOW_EPOCH_SECONDS = Math.floor(NOW.getTime() / 1000);
const ALLOW_CACHE_MINUTES = 10;

const makeProject = (): Project => ({
  id: 'project-1',
  url: 'https://github.com/users/user/projects/1',
  databaseId: 1,
  name: 'Test Project',
  status: {
    name: 'Status',
    fieldId: 'field-1',
    statuses: [],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: null,
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
});

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: IN_TMUX_STATUS_NAME,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(),
  author: '',
  closingIssueReferenceUrls: [],
  ...overrides,
});

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn().mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  }),
});

const createMockIssueRepository = (
  issues: Issue[],
): Pick<IssueRepository, 'getAllOpened'> => ({
  getAllOpened: jest.fn().mockResolvedValue(issues),
});

describe('notifySilentTmuxSessions', () => {
  let outputDirectory: string;
  let cacheDirectory: string;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-output-'));
    cacheDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'silent-cache-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(outputDirectory, { force: true, recursive: true });
    fs.rmSync(cacheDirectory, { force: true, recursive: true });
  });

  const writeSilentOutputFile = (sessionName: string): void => {
    const fileName = sessionName.replace(/\//g, '_');
    const filePath = path.join(outputDirectory, fileName);
    fs.writeFileSync(filePath, 'output', 'utf8');
    const silentEpoch = NOW_EPOCH_SECONDS - 11 * 60;
    fs.utimesSync(filePath, silentEpoch, silentEpoch);
  };

  const makeCacheRepository = (): LocalStorageCacheRepository =>
    new LocalStorageCacheRepository(
      new LocalStorageRepository(),
      cacheDirectory,
    );

  it('sends a self-check notification to a silent monitored live session', async () => {
    const sessionName = 'https_//github_com/demo/repo/issues/1';
    writeSilentOutputFile(sessionName);
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${sessionName}\n`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await notifySilentTmuxSessions({
      project: makeProject(),
      allowCacheMinutes: ALLOW_CACHE_MINUTES,
      issueRepository: createMockIssueRepository([makeIssue()]),
      localCommandRunner: runner,
      cacheRepository: makeCacheRepository(),
      sessionOutputRootDirectory: outputDirectory,
      now: NOW,
    });

    const sendCall = runner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(sendCall?.[1][2]).toBe(sessionName);
  });

  it('does nothing when the session output root directory is not configured', async () => {
    const sessionName = 'https_//github_com/demo/repo/issues/1';
    writeSilentOutputFile(sessionName);
    const runner = createMockRunner();

    await notifySilentTmuxSessions({
      project: makeProject(),
      allowCacheMinutes: ALLOW_CACHE_MINUTES,
      issueRepository: createMockIssueRepository([makeIssue()]),
      localCommandRunner: runner,
      cacheRepository: makeCacheRepository(),
      sessionOutputRootDirectory: null,
      now: NOW,
    });

    expect(runner.runCommand.mock.calls).toHaveLength(0);
  });

  it('does not re-notify the same silent session on the next cycle within cooldown', async () => {
    const sessionName = 'https_//github_com/demo/repo/issues/1';
    writeSilentOutputFile(sessionName);
    const runner = createMockRunner();
    runner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${sessionName}\n`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });
    const cacheRepository = makeCacheRepository();

    await notifySilentTmuxSessions({
      project: makeProject(),
      allowCacheMinutes: ALLOW_CACHE_MINUTES,
      issueRepository: createMockIssueRepository([makeIssue()]),
      localCommandRunner: runner,
      cacheRepository,
      sessionOutputRootDirectory: outputDirectory,
      now: NOW,
    });

    const secondRunner = createMockRunner();
    secondRunner.runCommand.mockImplementation(async (program, args) => {
      if (program === 'tmux' && args[0] === 'list-sessions') {
        return { stdout: `${sessionName}\n`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    });

    await notifySilentTmuxSessions({
      project: makeProject(),
      allowCacheMinutes: ALLOW_CACHE_MINUTES,
      issueRepository: createMockIssueRepository([makeIssue()]),
      localCommandRunner: secondRunner,
      cacheRepository,
      sessionOutputRootDirectory: outputDirectory,
      now: new Date(NOW.getTime() + 60 * 1000),
    });

    const secondSendCall = secondRunner.runCommand.mock.calls.find(
      (call) => call[0] === 'tmux' && call[1][0] === 'send-keys',
    );
    expect(secondSendCall).toBeUndefined();
  });
});
