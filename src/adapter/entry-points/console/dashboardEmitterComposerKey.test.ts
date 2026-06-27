import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import {
  DASHBOARD_PROJECT_NAMES,
  toDashboardDisplayLabel,
} from '../../../domain/usecases/dashboard/DashboardProjectCode';
import { writeDashboardRow } from '../handlers/dashboardRowWriter';
import {
  composeDashboardText,
  dashboardComposeFilesPresent,
} from './dashboardComposeService';
import { DEFAULT_DASHBOARD_PROJECT_NAMES } from './webServer';

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

describe('dashboard emitter filename matches composer lookup key', () => {
  let dir: string;

  beforeEach(() => {
    issueCounter = 0;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-key-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it.each(DASHBOARD_PROJECT_NAMES)(
    'emits projects/%s.json under the full project name the composer reads',
    (projectName) => {
      writeDashboardRow({
        dashboardDataDir: dir,
        pjcode: projectName,
        assigneeLogin: ASSIGNEE,
        issues: [makeIssue({ status: 'Unread' })],
        generatedAt: '2026-06-26T12:00:00.000Z',
      });

      const composerLookupPath = path.join(
        dir,
        'projects',
        `${projectName}.json`,
      );
      expect(fs.existsSync(composerLookupPath)).toBe(true);
    },
  );

  it('detects compose files present when every project name file exists', () => {
    for (const projectName of DASHBOARD_PROJECT_NAMES) {
      writeDashboardRow({
        dashboardDataDir: dir,
        pjcode: projectName,
        assigneeLogin: ASSIGNEE,
        issues: [makeIssue({ status: 'Unread' })],
        generatedAt: '2026-06-26T12:00:00.000Z',
      });
    }
    fs.writeFileSync(
      path.join(dir, 'machine-status.json'),
      JSON.stringify({
        memPct: 1,
        cpuPct: 2,
        diskPct: 3,
        load: [0, 0, 0],
        cycleMinutes: 1,
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'token-status.json'),
      JSON.stringify({ tokens: [] }),
    );

    expect(
      dashboardComposeFilesPresent({
        dashboardDataDir: dir,
        projectNames: DEFAULT_DASHBOARD_PROJECT_NAMES,
      }),
    ).toBe(true);
  });

  it('composes the full grid with no fallback row and shows the 2-char display labels', () => {
    const issuesByName: Record<string, Issue[]> = {
      umino: [makeIssue({ status: 'Unread' }), makeIssue({ status: 'Unread' })],
      xmile: [makeIssue({ status: 'Awaiting Quality Check' })],
      xcare: [makeIssue({ status: 'Awaiting Workspace' })],
      utage3: [makeIssue({ status: 'Todo by human' })],
    };
    for (const projectName of DASHBOARD_PROJECT_NAMES) {
      writeDashboardRow({
        dashboardDataDir: dir,
        pjcode: projectName,
        assigneeLogin: ASSIGNEE,
        issues: issuesByName[projectName],
        generatedAt: '2026-06-26T12:00:00.000Z',
      });
    }
    fs.writeFileSync(
      path.join(dir, 'machine-status.json'),
      JSON.stringify({
        memPct: 55,
        cpuPct: 62,
        diskPct: 93,
        load: [16, 23, 40],
        cycleMinutes: 13,
      }),
    );
    fs.writeFileSync(
      path.join(dir, 'token-status.json'),
      JSON.stringify({ tokens: [] }),
    );

    const composed = composeDashboardText({
      dashboardDataDir: dir,
      projectNames: DEFAULT_DASHBOARD_PROJECT_NAMES,
    });

    const wrap = (line: string): string =>
      `<tt>${line.replace(/ /g, '&nbsp;')}</tt><br>`;
    const expected =
      [
        wrap('M55% C62% D93% cy13'),
        wrap('LA 16 23 40'),
        wrap('pj   unr tdo aqc fal prp aws dep'),
        wrap(`🟢${toDashboardDisplayLabel('umino')}   2   0   0   0   0   0   0`),
        wrap(`🟢${toDashboardDisplayLabel('xmile')}   0   0   1   0   0   0   0`),
        wrap(`🟢${toDashboardDisplayLabel('xcare')}   0   0   0   0   0   1   0`),
        wrap(
          `🟢${toDashboardDisplayLabel('utage3')}   0   1   0   0   0   0   0`,
        ),
        wrap(''),
      ].join('\n') + '\n';
    expect(composed).toBe(expected);
    expect(composed).not.toContain('--');
  });
});
