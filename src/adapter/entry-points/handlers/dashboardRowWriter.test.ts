import fs from 'fs';
import os from 'os';
import path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { DashboardRowFile, writeDashboardRow } from './dashboardRowWriter';

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

const ASSIGNEE = 'HiromiShikata';

let issueCounter = 0;
const makeIssue = (overrides: Partial<Issue>): Issue => {
  issueCounter += 1;
  return {
    nameWithOwner: 'demo/repo',
    number: issueCounter,
    title: `Issue ${issueCounter}`,
    state: 'OPEN',
    status: null,
    story: null,
    nextActionDate: null,
    nextActionHour: null,
    estimationMinutes: null,
    dependedIssueUrls: [],
    completionDate50PercentConfidence: null,
    url: `https://github.com/demo/repo/issues/${issueCounter}`,
    assignees: [ASSIGNEE],
    labels: [],
    org: 'demo',
    repo: 'repo',
    body: '',
    itemId: `item-${issueCounter}`,
    isPr: false,
    isInProgress: false,
    isClosed: false,
    createdAt: new Date('2026-06-13T08:18:45.000Z'),
    author: 'someone',
    closingIssueReferenceUrls: [],
    ...overrides,
  };
};

describe('writeDashboardRow', () => {
  let dir: string;

  beforeEach(() => {
    issueCounter = 0;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-row-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a per-project row file with counts, pjcode and capturedAt', () => {
    writeDashboardRow({
      dashboardDataDir: dir,
      pjcode: 'um',
      assigneeLogin: ASSIGNEE,
      issues: [
        makeIssue({ status: 'Unread' }),
        makeIssue({ status: 'Awaiting Quality Check' }),
      ],
      generatedAt: '2026-06-26T12:00:00.000Z',
    });

    const written = readJson(path.join(dir, 'projects', 'um.json'));
    const expected: DashboardRowFile = {
      pjcode: 'um',
      capturedAt: '2026-06-26T12:00:00.000Z',
      unread: 1,
      todo: 0,
      qc: 1,
      fail: 0,
      pr: 0,
      ws: 0,
      dep: 0,
      blocker: 0,
    };
    expect(written).toEqual(expected);
  });

  it('is a no-op when dashboardDataDir is unset', () => {
    writeDashboardRow({
      dashboardDataDir: null,
      pjcode: 'um',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue({ status: 'Unread' })],
    });

    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('is a no-op when pjcode or assigneeLogin is missing', () => {
    writeDashboardRow({
      dashboardDataDir: dir,
      pjcode: null,
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue({ status: 'Unread' })],
    });
    writeDashboardRow({
      dashboardDataDir: dir,
      pjcode: 'um',
      assigneeLogin: null,
      issues: [makeIssue({ status: 'Unread' })],
    });

    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
