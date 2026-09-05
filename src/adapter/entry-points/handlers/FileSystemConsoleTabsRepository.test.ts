import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemConsoleTabsRepository } from './FileSystemConsoleTabsRepository';
import { readDoneProjectItemIds } from '../console/consoleDoneStore';
import type { ConsoleListItem } from '../../../domain/usecases/console/GenerateConsoleListsUseCase';

const makeItem = (
  overrides: Partial<ConsoleListItem> = {},
): ConsoleListItem => ({
  number: 1,
  title: 'Test Issue',
  url: 'https://github.com/user/repo/issues/1',
  repo: 'user/repo',
  nameWithOwner: 'user/repo',
  projectItemId: 'item-1',
  itemId: 'item-1',
  isPr: false,
  story: 'Story A',
  status: 'Awaiting Quality Check',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
  relatedOpenPullRequestUrls: [],
  ...overrides,
});

const makeStatusTab = (
  pjcode: string,
  items: ConsoleListItem[],
  storyOrder: string[] = ['Story A', 'Story B'],
) => ({
  pjcode,
  generatedAt: '2026-08-16T04:19:32Z',
  statusOptions: [],
  storyOrder,
  storyColors: {},
  items,
});

describe('FileSystemConsoleTabsRepository', () => {
  let dir: string;
  const PJCODE = 'test-project';

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'console-tabs-repository-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeTabFile = (tab: string, data: unknown): void => {
    const tabDir = path.join(dir, PJCODE, tab);
    fs.mkdirSync(tabDir, { recursive: true });
    fs.writeFileSync(path.join(tabDir, 'list.json'), JSON.stringify(data));
  };

  const readTabFile = (tab: string): unknown => {
    const filePath = path.join(dir, PJCODE, tab, 'list.json');
    const data: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return data;
  };

  it('inserts the item into the prs tab when transitioning to Awaiting Quality Check', () => {
    writeTabFile('prs', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem({ status: 'Awaiting Quality Check' });

    repo.patchIssueTabTransition({
      projectItemId: item.projectItemId,
      item,
      targetTabName: 'prs',
    });

    expect(readTabFile('prs')).toMatchObject({
      items: [{ projectItemId: 'item-1' }],
    });
  });

  it('preserves generatedAt in the patched tab file', () => {
    writeTabFile('prs', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem();

    repo.patchIssueTabTransition({
      projectItemId: item.projectItemId,
      item,
      targetTabName: 'prs',
    });

    expect(readTabFile('prs')).toHaveProperty(
      'generatedAt',
      '2026-08-16T04:19:32Z',
    );
  });

  it('removes the item from any tab it previously appeared in', () => {
    const existingItem = makeItem({ projectItemId: 'item-1' });
    writeTabFile('todo-by-human', makeStatusTab(PJCODE, [existingItem]));
    writeTabFile('prs', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem({ status: 'Awaiting Quality Check' });

    repo.patchIssueTabTransition({
      projectItemId: 'item-1',
      item,
      targetTabName: 'prs',
    });

    expect(readTabFile('todo-by-human')).toMatchObject({ items: [] });
    expect(readTabFile('prs')).toMatchObject({
      items: [{ projectItemId: 'item-1' }],
    });
  });

  it('removes the projectItemId from the target tab .done.json', () => {
    writeTabFile('prs', makeStatusTab(PJCODE, []));
    const doneFilePath = path.join(dir, PJCODE, 'prs', '.done.json');
    fs.writeFileSync(
      doneFilePath,
      JSON.stringify({ projectItemIds: ['item-1', 'item-2'] }),
    );
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem();

    repo.patchIssueTabTransition({
      projectItemId: 'item-1',
      item,
      targetTabName: 'prs',
    });

    const ids = readDoneProjectItemIds(dir, PJCODE, 'prs');
    expect(ids).not.toContain('item-1');
    expect(ids).toContain('item-2');
  });

  it('is a no-op when the target tab file does not exist', () => {
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem();

    expect(() =>
      repo.patchIssueTabTransition({
        projectItemId: item.projectItemId,
        item,
        targetTabName: 'prs',
      }),
    ).not.toThrow();
    expect(fs.existsSync(path.join(dir, PJCODE, 'prs', 'list.json'))).toBe(
      false,
    );
  });

  it('removes the item from any tab and writes nothing when targetTabName is null', () => {
    const existingItem = makeItem({ projectItemId: 'item-1' });
    writeTabFile('prs', makeStatusTab(PJCODE, [existingItem]));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem({ status: 'Awaiting Workspace' });

    repo.patchIssueTabTransition({
      projectItemId: 'item-1',
      item,
      targetTabName: null,
    });

    expect(readTabFile('prs')).toMatchObject({ items: [] });
  });

  it('maintains story order after inserting the new item', () => {
    const itemInStoryB = makeItem({
      projectItemId: 'item-2',
      story: 'Story B',
    });
    writeTabFile('prs', makeStatusTab(PJCODE, [itemInStoryB]));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem({
      projectItemId: 'item-1',
      story: 'Story A',
      status: 'Awaiting Quality Check',
    });

    repo.patchIssueTabTransition({
      projectItemId: 'item-1',
      item,
      targetTabName: 'prs',
    });

    expect(readTabFile('prs')).toMatchObject({
      items: [{ story: 'Story A' }, { story: 'Story B' }],
    });
  });

  it('does not write to tab files that do not contain the item when targetTabName is null', () => {
    const otherItem = makeItem({ projectItemId: 'item-99' });
    writeTabFile('prs', makeStatusTab(PJCODE, [otherItem]));
    const mtimeBefore = fs.statSync(
      path.join(dir, PJCODE, 'prs', 'list.json'),
    ).mtimeMs;
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem({ projectItemId: 'item-1' });

    repo.patchIssueTabTransition({
      projectItemId: 'item-1',
      item,
      targetTabName: null,
    });

    const mtimeAfter = fs.statSync(
      path.join(dir, PJCODE, 'prs', 'list.json'),
    ).mtimeMs;
    expect(mtimeAfter).toBe(mtimeBefore);
  });
});

describe('FileSystemConsoleTabsRepository.moveItemToQueuedTab', () => {
  let dir: string;
  const PJCODE = 'test-project';

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'console-tabs-move-queued-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeTabFile = (tab: string, data: unknown): void => {
    const tabDir = path.join(dir, PJCODE, tab);
    fs.mkdirSync(tabDir, { recursive: true });
    fs.writeFileSync(path.join(tabDir, 'list.json'), JSON.stringify(data));
  };

  const isObjectWithItems = (value: unknown): value is { items: unknown[] } => {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return false;
    if (!('items' in value)) return false;
    return Array.isArray(value.items);
  };

  const readTabItems = (tab: string): unknown[] => {
    const filePath = path.join(dir, PJCODE, tab, 'list.json');
    const data: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isObjectWithItems(data) ? data.items : [];
  };

  const makeItem = (
    overrides: Partial<ConsoleListItem> = {},
  ): ConsoleListItem => ({
    number: 1,
    title: 'Test Issue',
    url: 'https://github.com/user/repo/issues/1',
    repo: 'user/repo',
    nameWithOwner: 'user/repo',
    projectItemId: 'item-1',
    itemId: 'item-1',
    isPr: false,
    story: 'Story A',
    status: 'Todo by agent',
    agent: null,
    nextActionDate: null,
    nextActionHour: null,
    dependedIssueUrls: [],
    labels: [],
    createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
    relatedOpenPullRequestUrls: [],
    ...overrides,
  });

  const makeStatusTab = (
    pjcode: string,
    items: ConsoleListItem[],
    storyOrder: string[] = ['Story A'],
  ) => ({
    pjcode,
    generatedAt: '2026-09-04T00:00:00Z',
    statusOptions: [],
    agentOptions: [],
    storyOrder,
    storyColors: {},
    items,
  });

  it('moves the item from todo-by-agent to queued with the new status', () => {
    const item = makeItem({ projectItemId: 'item-1', status: 'Todo by agent' });
    writeTabFile('todo-by-agent', makeStatusTab(PJCODE, [item]));
    writeTabFile('queued', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);

    repo.moveItemToQueuedTab('item-1', 'Awaiting Workspace');

    expect(readTabItems('queued')).toMatchObject([
      { projectItemId: 'item-1', status: 'Awaiting Workspace' },
    ]);
    expect(readTabItems('todo-by-agent')).toEqual([]);
  });

  it('is a no-op when the item is not found in any tab', () => {
    writeTabFile('todo-by-agent', makeStatusTab(PJCODE, []));
    writeTabFile('queued', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);

    expect(() =>
      repo.moveItemToQueuedTab('nonexistent', 'Awaiting Workspace'),
    ).not.toThrow();
    expect(readTabItems('queued')).toEqual([]);
  });

  it('moves the item when it is already in the queued tab under a different status', () => {
    const item = makeItem({ projectItemId: 'item-1', status: 'Preparation' });
    writeTabFile('queued', makeStatusTab(PJCODE, [item]));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);

    repo.moveItemToQueuedTab('item-1', 'Awaiting Workspace');

    expect(readTabItems('queued')).toMatchObject([
      { projectItemId: 'item-1', status: 'Awaiting Workspace' },
    ]);
  });

  it('leaves the source tab unchanged when queued/list.json does not exist', () => {
    const item = makeItem({ projectItemId: 'item-1', status: 'Todo by agent' });
    writeTabFile('todo-by-agent', makeStatusTab(PJCODE, [item]));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);

    repo.moveItemToQueuedTab('item-1', 'Awaiting Workspace');

    expect(readTabItems('todo-by-agent')).toMatchObject([
      { projectItemId: 'item-1' },
    ]);
  });
});
