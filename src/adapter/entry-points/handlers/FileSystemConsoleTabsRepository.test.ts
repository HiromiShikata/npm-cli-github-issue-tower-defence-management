import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileSystemConsoleTabsRepository } from './FileSystemConsoleTabsRepository';
import type { ConsoleListItem } from '../../../domain/usecases/console/GenerateConsoleListsUseCase';

const makeItem = (overrides: Partial<ConsoleListItem> = {}): ConsoleListItem => ({
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
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  };

  const readDoneFile = (tab: string): { projectItemIds: string[] } => {
    const filePath = path.join(dir, PJCODE, tab, '.done.json');
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return { projectItemIds: [] };
    }
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

    const result = readTabFile('prs') as ReturnType<typeof makeStatusTab>;
    expect(result.items).toHaveLength(1);
    expect(result.items[0].projectItemId).toBe('item-1');
  });

  it('preserves generatedAt in the patched tab file', () => {
    const expectedGeneratedAt = '2026-08-16T04:19:32Z';
    writeTabFile('prs', makeStatusTab(PJCODE, []));
    const repo = new FileSystemConsoleTabsRepository(dir, PJCODE);
    const item = makeItem();

    repo.patchIssueTabTransition({
      projectItemId: item.projectItemId,
      item,
      targetTabName: 'prs',
    });

    const result = readTabFile('prs') as ReturnType<typeof makeStatusTab>;
    expect(result.generatedAt).toBe(expectedGeneratedAt);
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

    const prevTab = readTabFile('todo-by-human') as ReturnType<
      typeof makeStatusTab
    >;
    expect(prevTab.items).toHaveLength(0);

    const nextTab = readTabFile('prs') as ReturnType<typeof makeStatusTab>;
    expect(nextTab.items).toHaveLength(1);
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

    const done = readDoneFile('prs');
    expect(done.projectItemIds).not.toContain('item-1');
    expect(done.projectItemIds).toContain('item-2');
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
    expect(
      fs.existsSync(path.join(dir, PJCODE, 'prs', 'list.json')),
    ).toBe(false);
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

    const result = readTabFile('prs') as ReturnType<typeof makeStatusTab>;
    expect(result.items).toHaveLength(0);
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

    const result = readTabFile('prs') as ReturnType<typeof makeStatusTab>;
    expect(result.items).toHaveLength(2);
    expect(result.items[0].story).toBe('Story A');
    expect(result.items[1].story).toBe('Story B');
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
