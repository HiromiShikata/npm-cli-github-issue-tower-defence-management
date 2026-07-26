import fs from 'fs';
import os from 'os';
import path from 'path';
import { mock } from 'jest-mock-extended';
import { Issue } from '../../../domain/entities/Issue';
import { FieldOption, Project } from '../../../domain/entities/Project';
import {
  buildConsoleDataResponse,
  parseConsoleDataRoute,
} from '../console/consoleDataDelivery';
import {
  CONSOLE_DONE_TAB_NAMES,
  readDoneProjectItemIds,
  recordDoneProjectItemId,
} from '../console/consoleDoneStore';
import {
  formatConsoleGeneratedAt,
  writeConsoleLists,
} from './consoleListsWriter';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isUnknownArray = (value: unknown): value is unknown[] =>
  Array.isArray(value);

const ASSIGNEE = 'owner-login';

const option = (
  id: string,
  name: string,
  color: FieldOption['color'],
): FieldOption => ({ id, name, color, description: '' });

const project: Project = {
  ...mock<Project>(),
  status: {
    name: 'Status',
    fieldId: 'status-field',
    statuses: [
      option('st-unread', 'Unread', 'ORANGE'),
      option('st-aw', 'Awaiting Workspace', 'BLUE'),
      option('st-aqc', 'Awaiting Quality Check', 'GREEN'),
    ],
  },
  story: {
    name: 'story',
    fieldId: 'story-field',
    databaseId: 2,
    stories: [option('s1', 'Story Alpha', 'BLUE')],
    workflowManagementStory: { id: 'wm', name: 'workflow management' },
  },
};

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  ...mock<Issue>(),
  number: 1,
  title: 'Issue 1',
  nameWithOwner: 'demo/repo',
  url: 'https://github.com/demo/repo/issues/1',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  assignees: [ASSIGNEE],
  labels: [],
  body: 'should never be written',
  itemId: 'item-1',
  isPr: false,
  isClosed: false,
  createdAt: new Date('2026-06-13T08:18:45.000Z'),
  ...overrides,
});

describe('writeConsoleLists', () => {
  let outDir: string;

  beforeEach(() => {
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-out-'));
  });

  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const tabFile = (tab: string): string =>
    path.join(outDir, 'demo', tab, 'list.json');

  it('writes every console tab list.json file', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Unread' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });

    for (const tab of [
      'workflow-blocker',
      'prs',
      'triage',
      'unread',
      'failed-preparation',
      'todo-by-human',
      'todo-by-agent',
    ]) {
      expect(fs.existsSync(tabFile(tab))).toBe(true);
    }
  });

  it('writes workflow-blocker items matched by story name regardless of status or actionability', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [
        makeIssue({
          story: 'regular / WORKFLOW BLOCKER',
          status: 'Awaiting Quality Check',
          nextActionHour: 9,
        }),
        makeIssue({ story: 'Story Alpha', status: 'Unread' }),
      ],
      workflowBlockerStoryName: 'regular / WORKFLOW BLOCKER',
      generatedAt: '2026-06-14T07:22:33Z',
    });

    const raw: unknown = JSON.parse(
      fs.readFileSync(tabFile('workflow-blocker'), 'utf8'),
    );
    expect(isRecord(raw)).toBe(true);
    const items: unknown = isRecord(raw) ? raw.items : undefined;
    expect(isUnknownArray(items)).toBe(true);
    expect(isUnknownArray(items) ? items.length : 0).toBe(1);
  });

  it('writes an empty workflow-blocker list when no story name is configured', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ story: 'regular / WORKFLOW BLOCKER' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });

    const raw: unknown = JSON.parse(
      fs.readFileSync(tabFile('workflow-blocker'), 'utf8'),
    );
    const items: unknown = isRecord(raw) ? raw.items : undefined;
    expect(isUnknownArray(items) ? items.length : 0).toBe(0);
  });

  it('writes todo-by-human items selected by the Todo by human status', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Todo by human' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });

    const raw: unknown = JSON.parse(
      fs.readFileSync(tabFile('todo-by-human'), 'utf8'),
    );
    expect(isRecord(raw)).toBe(true);
    const items: unknown = isRecord(raw) ? raw.items : undefined;
    expect(isUnknownArray(items)).toBe(true);
    expect(isUnknownArray(items) ? items.length : 0).toBe(1);
  });

  it('writes todo-by-agent items selected by the Todo by agent status', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Todo by agent' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });

    const raw: unknown = JSON.parse(
      fs.readFileSync(tabFile('todo-by-agent'), 'utf8'),
    );
    expect(isRecord(raw)).toBe(true);
    const items: unknown = isRecord(raw) ? raw.items : undefined;
    expect(isUnknownArray(items)).toBe(true);
    expect(isUnknownArray(items) ? items.length : 0).toBe(1);
  });

  it('writes items with no body field', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Unread' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });

    const raw: unknown = JSON.parse(fs.readFileSync(tabFile('unread'), 'utf8'));
    expect(isRecord(raw)).toBe(true);
    const items: unknown = isRecord(raw) ? raw.items : undefined;
    expect(isUnknownArray(items)).toBe(true);
    const firstItem: unknown = isUnknownArray(items) ? items[0] : undefined;
    expect(isRecord(firstItem)).toBe(true);
    expect(firstItem).not.toHaveProperty('body');
  });

  it('does not leave a temp file behind after writing', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [],
      generatedAt: '2026-06-14T07:22:33Z',
    });
    expect(fs.existsSync(`${tabFile('prs')}.tmp`)).toBe(false);
  });

  it('is a no-op when consoleDataOutputDir is unset', () => {
    writeConsoleLists({
      consoleDataOutputDir: undefined,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Unread' })],
    });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });

  it('is a no-op when pjcode is unset', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: '',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Unread' })],
    });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });

  it('is a no-op when assigneeLogin is unset', () => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: null,
      project,
      issues: [makeIssue({ status: 'Unread' })],
    });
    expect(fs.readdirSync(outDir)).toHaveLength(0);
  });

  const regenerateUnread = (): void => {
    writeConsoleLists({
      consoleDataOutputDir: outDir,
      pjcode: 'demo',
      assigneeLogin: ASSIGNEE,
      project,
      issues: [makeIssue({ status: 'Unread', itemId: 'item-1' })],
      generatedAt: '2026-06-14T07:22:33Z',
    });
  };

  const unreadServedItemCount = (): number => {
    const route = parseConsoleDataRoute('projects/demo/unread/list.json');
    if (route === null) {
      throw new Error('route should not be null');
    }
    const response = buildConsoleDataResponse(outDir, route);
    const body: unknown = JSON.parse(response.body);
    const items: unknown = isRecord(body) ? body.items : undefined;
    return isUnknownArray(items) ? items.length : 0;
  };

  it('resets the done file of every tab to an empty record on regeneration', () => {
    regenerateUnread();

    for (const tab of CONSOLE_DONE_TAB_NAMES) {
      const doneFile = path.join(outDir, 'demo', tab, '.done.json');
      expect(fs.existsSync(doneFile)).toBe(true);
      const raw: unknown = JSON.parse(fs.readFileSync(doneFile, 'utf8'));
      expect(raw).toEqual({ projectItemIds: [] });
    }
  });

  it('clears a pre-existing accumulated done file on regeneration', () => {
    for (const id of ['PVTI_1', 'PVTI_2', 'PVTI_3']) {
      recordDoneProjectItemId(outDir, 'demo', 'unread', id);
    }
    expect(readDoneProjectItemIds(outDir, 'demo', 'unread')).toHaveLength(3);

    regenerateUnread();

    expect(readDoneProjectItemIds(outDir, 'demo', 'unread')).toEqual([]);
  });

  it('serves the full list after regeneration despite a prior accumulated done record', () => {
    recordDoneProjectItemId(outDir, 'demo', 'unread', 'item-1');

    regenerateUnread();

    expect(unreadServedItemCount()).toBe(1);
  });

  it('re-hides an item recorded as done until the next regeneration bounds it to one cycle', () => {
    regenerateUnread();
    expect(unreadServedItemCount()).toBe(1);

    recordDoneProjectItemId(outDir, 'demo', 'unread', 'item-1');
    expect(unreadServedItemCount()).toBe(0);

    regenerateUnread();
    expect(unreadServedItemCount()).toBe(1);
  });
});

describe('formatConsoleGeneratedAt', () => {
  it('strips milliseconds and keeps the trailing Z', () => {
    expect(formatConsoleGeneratedAt(new Date('2026-06-14T07:22:33.456Z'))).toBe(
      '2026-06-14T07:22:33Z',
    );
  });
});
