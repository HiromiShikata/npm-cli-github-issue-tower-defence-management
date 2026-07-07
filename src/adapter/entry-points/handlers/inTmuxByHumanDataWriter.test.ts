import fs from 'fs';
import os from 'os';
import path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { FieldOption, Project } from '../../../domain/entities/Project';
import { writeInTmuxByHumanData } from './inTmuxByHumanDataWriter';

const ASSIGNEE = 'owner-login';
const CONSOLE_BASE_URL = 'https://console.example.test';
const CONSOLE_TOKEN = 'test-token-value';
const NOW = new Date('2026-06-25T12:00:00.000Z');

const option = (
  id: string,
  name: string,
  color: FieldOption['color'],
): FieldOption => ({ id, name, color, description: '' });

const project: Project = {
  id: 'project-node-id',
  url: 'https://github.com/orgs/demo/projects/1',
  databaseId: 1,
  name: 'demo',
  status: {
    name: 'Status',
    fieldId: 'status-field',
    statuses: [option('st-tmux', 'In Tmux by human', 'RED')],
  },
  nextActionDate: null,
  nextActionHour: null,
  story: {
    name: 'story',
    fieldId: 'story-field',
    databaseId: 2,
    stories: [option('s1', 'Story Alpha', 'BLUE')],
    workflowManagementStory: { id: 'wm', name: 'workflow management' },
  },
  remainingEstimationMinutes: null,
  dependedIssueUrlSeparatedByComma: null,
  completionDate50PercentConfidence: null,
};

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue 1',
  state: 'OPEN',
  status: 'In Tmux by human',
  story: 'Story Alpha',
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [ASSIGNEE],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: 'should never be written',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-06-13T08:18:45.000Z'),
  author: 'someone',
  closingIssueReferenceUrls: [],
  ...overrides,
});

const baseParams = (outDir: string) => ({
  inTmuxDataOutputDir: outDir,
  inTmuxConsoleBaseUrl: CONSOLE_BASE_URL,
  inTmuxConsoleToken: CONSOLE_TOKEN,
  inTmuxProjectOrder: ['demo'],
  pjcode: 'demo',
  assigneeLogin: ASSIGNEE,
  org: 'demo-org',
  repo: 'demo-repo',
  project,
  issues: [makeIssue({})],
  now: NOW,
});

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

describe('writeInTmuxByHumanData', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'intmux-out-'));
  });

  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const file = (name: string): string => path.join(outDir, name);

  it('writes the four per-project files and the four index files', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    for (const name of [
      'demo.json',
      'demo.v2.json',
      'demo.v3.json',
      'demo.v4.json',
      'index.json',
      'index.v2.json',
      'index.v3.json',
      'index.v4.json',
    ]) {
      expect(fs.existsSync(file(name))).toBe(true);
    }
  });

  it('writes pretty-printed JSON ending with a trailing newline', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    const raw = fs.readFileSync(file('demo.json'), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toContain('\n  ');
  });

  it('writes the v1 shape with a flat url string array', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    expect(readJson(file('demo.json'))).toEqual([
      {
        story: 'Story Alpha',
        urls: ['https://github.com/demo/repo/issues/1'],
      },
    ]);
  });

  it('writes the v2 shape with url and title objects', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    expect(readJson(file('demo.v2.json'))).toEqual([
      {
        story: 'Story Alpha',
        urls: [
          { url: 'https://github.com/demo/repo/issues/1', title: 'Issue 1' },
        ],
      },
    ]);
  });

  it('writes the v3 document with overviewUrl and a token-free console url', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    expect(readJson(file('demo.v3.json'))).toEqual({
      version: 3,
      overviewUrl: 'https://github.com/orgs/demo/projects/1',
      tdpmConsoleUrl: 'https://console.example.test/projects/demo',
      groups: [
        {
          story: 'Story Alpha',
          urls: [
            { url: 'https://github.com/demo/repo/issues/1', title: 'Issue 1' },
          ],
        },
      ],
    });
  });

  it('writes the v4 document with the token-bearing console url and derived new issue url', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    expect(readJson(file('demo.v4.json'))).toEqual({
      version: 4,
      overviewUrl: 'https://github.com/orgs/demo/projects/1',
      tdpmConsoleUrl:
        'https://console.example.test/projects/demo?k=test-token-value',
      newIssueUrl:
        'https://github.com/demo-org/demo-repo/issues/new?assignees=owner-login',
      groups: [
        {
          story: 'Story Alpha',
          sessions: [
            {
              name: 'https://github.com/demo/repo/issues/1',
              description: 'Issue 1',
            },
          ],
        },
      ],
    });
  });

  it('overrides the repo segment of the v4 new issue url when newIssueRepo is passed', () => {
    writeInTmuxByHumanData({
      ...baseParams(outDir),
      newIssueRepo: 'other-repo',
    });
    expect(readJson(file('demo.v4.json'))).toMatchObject({
      newIssueUrl:
        'https://github.com/demo-org/other-repo/issues/new?assignees=owner-login',
    });
  });

  it('writes index files listing configured projects whose per-project file exists', () => {
    fs.writeFileSync(file('xmile.json'), '[]\n');
    writeInTmuxByHumanData({
      ...baseParams(outDir),
      inTmuxProjectOrder: ['demo', 'xmile', 'xcare'],
    });
    expect(readJson(file('index.json'))).toEqual({
      projects: ['demo', 'xmile'],
    });
    expect(readJson(file('index.v2.json'))).toEqual({
      version: 2,
      projects: ['demo', 'xmile'],
    });
    expect(readJson(file('index.v3.json'))).toEqual({
      version: 3,
      projects: ['demo', 'xmile'],
    });
  });

  it('builds the v4 index path from the output dir basename and the token', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    const basename = path.basename(outDir);
    expect(readJson(file('index.v4.json'))).toEqual({
      version: 4,
      projects: [
        { name: 'demo', path: `/${basename}/demo.v4.json?k=test-token-value` },
      ],
    });
  });

  it('skips the v4 file and the v4 index when the token is unset but still writes v1, v2, v3 and v1-v3 index', () => {
    writeInTmuxByHumanData({
      ...baseParams(outDir),
      inTmuxConsoleToken: undefined,
    });
    expect(fs.existsSync(file('demo.json'))).toBe(true);
    expect(fs.existsSync(file('demo.v2.json'))).toBe(true);
    expect(fs.existsSync(file('demo.v3.json'))).toBe(true);
    expect(fs.existsSync(file('demo.v4.json'))).toBe(false);
    expect(fs.existsSync(file('index.json'))).toBe(true);
    expect(fs.existsSync(file('index.v3.json'))).toBe(true);
    expect(fs.existsSync(file('index.v4.json'))).toBe(false);
  });

  it('skips the v3 and v4 files when the console base url is unset', () => {
    writeInTmuxByHumanData({
      ...baseParams(outDir),
      inTmuxConsoleBaseUrl: undefined,
    });
    expect(fs.existsSync(file('demo.json'))).toBe(true);
    expect(fs.existsSync(file('demo.v2.json'))).toBe(true);
    expect(fs.existsSync(file('demo.v3.json'))).toBe(false);
    expect(fs.existsSync(file('demo.v4.json'))).toBe(false);
  });

  it('skips the index files when the project order is empty', () => {
    writeInTmuxByHumanData({ ...baseParams(outDir), inTmuxProjectOrder: [] });
    expect(fs.existsSync(file('demo.json'))).toBe(true);
    expect(fs.existsSync(file('index.json'))).toBe(false);
  });

  it('does not leave a temp file behind after writing', () => {
    writeInTmuxByHumanData(baseParams(outDir));
    expect(fs.existsSync(`${file('demo.json')}.tmp`)).toBe(false);
  });

  it('is a no-op when the output dir is unset', () => {
    writeInTmuxByHumanData({
      ...baseParams(outDir),
      inTmuxDataOutputDir: undefined,
    });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });

  it('is a no-op when pjcode is unset', () => {
    writeInTmuxByHumanData({ ...baseParams(outDir), pjcode: '' });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });

  it('is a no-op when the assignee login is unset', () => {
    writeInTmuxByHumanData({ ...baseParams(outDir), assigneeLogin: null });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });
});
