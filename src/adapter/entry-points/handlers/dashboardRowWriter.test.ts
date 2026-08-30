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
    agent: null,
    stateReason: null,
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
      pjcode: 'ac',
      assigneeLogin: ASSIGNEE,
      issues: [
        makeIssue({ status: 'Awaiting Workspace' }),
        makeIssue({ status: 'Awaiting Quality Check' }),
      ],
      generatedAt: '2026-06-26T12:00:00.000Z',
    });

    const written = readJson(path.join(dir, 'projects', 'ac.json'));
    const expected: DashboardRowFile = {
      pjcode: 'ac',
      capturedAt: '2026-06-26T12:00:00.000Z',
      todo: 0,
      qc: 1,
      fail: 0,
      pr: 0,
      ws: 1,
      dep: 0,
      blocker: 0,
      humanPendingRed: 0,
      humanPendingYellow: 0,
      humanPendingBlue: 0,
    };
    expect(written).toEqual(expected);
  });

  it('is a no-op when dashboardDataDir is unset', () => {
    writeDashboardRow({
      dashboardDataDir: null,
      pjcode: 'ac',
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue({ status: 'Awaiting Workspace' })],
    });

    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it('is a no-op when pjcode or assigneeLogin is missing', () => {
    writeDashboardRow({
      dashboardDataDir: dir,
      pjcode: null,
      assigneeLogin: ASSIGNEE,
      issues: [makeIssue({ status: 'Awaiting Workspace' })],
    });
    writeDashboardRow({
      dashboardDataDir: dir,
      pjcode: 'ac',
      assigneeLogin: null,
      issues: [makeIssue({ status: 'Awaiting Workspace' })],
    });

    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
