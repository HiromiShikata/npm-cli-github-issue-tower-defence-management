import fs from 'fs';
import os from 'os';
import path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { toTmuxSessionName } from '../../../domain/usecases/intmux/InTmuxByHumanSessionReconcileUseCase';
import { cleanClosedIssueOwnerCallFiles } from './ownerCallFileCleaner';
import { ownerCallFileAppend, ownerCallFilePath } from './ownerCallFileStore';

const makeIssue = (overrides: Partial<Issue> = {}): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: 'In Tmux by human',
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: ['owner-login'],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  author: '',
  closingIssueReferenceUrls: [],
  ...overrides,
});

describe('cleanClosedIssueOwnerCallFiles', () => {
  let dataDir = '';

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'owner-call-cleaner-'));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const appendCallFor = (issue: Issue): string => {
    const sessionName = toTmuxSessionName(issue.url);
    ownerCallFileAppend({
      dataDir,
      projectCode: 'umino',
      ownerCall: {
        sessionName,
        calledAt: '2026-08-14T04:22:28Z',
        body: 'an unanswered call\n',
      },
    });
    return ownerCallFilePath(dataDir, 'umino', sessionName);
  };

  it('deletes the owner call file of a session whose issue is closed', () => {
    const closedIssue = makeIssue({
      url: 'https://github.com/demo/repo/issues/7',
      state: 'CLOSED',
      isClosed: true,
    });
    const filePath = appendCallFor(closedIssue);

    cleanClosedIssueOwnerCallFiles({
      inTmuxDataOutputDir: dataDir,
      pjcode: 'umino',
      issues: [closedIssue],
    });

    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('keeps the owner call file of a session whose issue is still open', () => {
    const openIssue = makeIssue();
    const filePath = appendCallFor(openIssue);

    cleanClosedIssueOwnerCallFiles({
      inTmuxDataOutputDir: dataDir,
      pjcode: 'umino',
      issues: [openIssue],
    });

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('does nothing when the data directory or the project code is not configured', () => {
    const closedIssue = makeIssue({ isClosed: true, state: 'CLOSED' });
    const filePath = appendCallFor(closedIssue);

    cleanClosedIssueOwnerCallFiles({
      inTmuxDataOutputDir: null,
      pjcode: 'umino',
      issues: [closedIssue],
    });
    cleanClosedIssueOwnerCallFiles({
      inTmuxDataOutputDir: dataDir,
      pjcode: null,
      issues: [closedIssue],
    });

    expect(fs.existsSync(filePath)).toBe(true);
  });
});
