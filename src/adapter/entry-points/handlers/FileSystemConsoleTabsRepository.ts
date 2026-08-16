import fs from 'fs';
import path from 'path';
import type {
  ConsoleListItem,
  ConsoleTabName,
} from '../../../domain/usecases/console/GenerateConsoleListsUseCase';
import type { ConsoleTabsRepository } from '../../../domain/usecases/adapter-interfaces/ConsoleTabsRepository';

const CONSOLE_LIST_TAB_NAMES: ConsoleTabName[] = [
  'workflow-blocker',
  'prs',
  'triage',
  'unread',
  'failed-preparation',
  'todo-by-human',
  'todo-by-agent',
];

const UNKNOWN_STORY_SORT_INDEX = 999999;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

const sortByStoryOrder = (
  items: ConsoleListItem[],
  storyOrder: string[],
): ConsoleListItem[] => {
  const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
  return items
    .map((item, position) => ({
      item,
      position,
      sortKey: indexByStory.get(item.story) ?? UNKNOWN_STORY_SORT_INDEX,
    }))
    .sort((a, b) => a.sortKey - b.sortKey || a.position - b.position)
    .map((entry) => entry.item);
};

const readTabListJson = (
  filePath: string,
): (Record<string, unknown> & { items: ConsoleListItem[] }) | null => {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
      return null;
    }
    return parsed as Record<string, unknown> & { items: ConsoleListItem[] };
  } catch {
    return null;
  }
};

const clearProjectItemIdFromDoneJson = (
  doneFilePath: string,
  projectItemId: string,
): void => {
  let existing: { projectItemIds: string[] } = { projectItemIds: [] };
  try {
    const raw = fs.readFileSync(doneFilePath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (isRecord(parsed) && Array.isArray(parsed.projectItemIds)) {
      existing = {
        projectItemIds: (parsed.projectItemIds as unknown[]).filter(
          (id): id is string => typeof id === 'string',
        ),
      };
    }
  } catch {
    // File does not exist; start with empty record
  }
  const updated = {
    projectItemIds: existing.projectItemIds.filter(
      (id) => id !== projectItemId,
    ),
  };
  writeJsonAtomic(doneFilePath, updated);
};

export class FileSystemConsoleTabsRepository implements ConsoleTabsRepository {
  constructor(
    private readonly consoleDataOutputDir: string,
    private readonly pjcode: string,
  ) {}

  patchIssueTabTransition(params: {
    projectItemId: string;
    item: ConsoleListItem;
    targetTabName: ConsoleTabName | null;
  }): void {
    const { projectItemId, item, targetTabName } = params;

    for (const tabName of CONSOLE_LIST_TAB_NAMES) {
      const filePath = path.join(
        this.consoleDataOutputDir,
        this.pjcode,
        tabName,
        'list.json',
      );
      const existing = readTabListJson(filePath);
      if (existing === null) {
        continue;
      }

      const items = existing.items;
      const withoutThisItem = items.filter(
        (i) => i.projectItemId !== projectItemId,
      );

      if (tabName === targetTabName) {
        const storyOrder = Array.isArray(existing.storyOrder)
          ? (existing.storyOrder as string[])
          : [];
        const newItems = sortByStoryOrder([...withoutThisItem, item], storyOrder);
        writeJsonAtomic(filePath, { ...existing, items: newItems });
        const doneFilePath = path.join(
          this.consoleDataOutputDir,
          this.pjcode,
          tabName,
          '.done.json',
        );
        clearProjectItemIdFromDoneJson(doneFilePath, projectItemId);
      } else if (withoutThisItem.length !== items.length) {
        writeJsonAtomic(filePath, { ...existing, items: withoutThisItem });
      }
    }
  }
}
