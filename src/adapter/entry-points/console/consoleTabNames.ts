import type { ConsoleTabName } from '../../../domain/usecases/console/GenerateConsoleListsUseCase';

export const CONSOLE_LIST_TAB_NAMES: ConsoleTabName[] = [
  'prs',
  'failed-preparation',
  'todo-by-human',
  'workflow-blocker',
  'todo-by-agent',
  'queued',
  'stories',
];

const UNKNOWN_STORY_SORT_INDEX = 999999;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const sortByStoryOrder = (
  items: unknown[],
  storyOrder: string[],
): unknown[] => {
  const indexByStory = new Map(storyOrder.map((name, index) => [name, index]));
  return items
    .map((item, position) => {
      const storyValue = isRecord(item) ? item.story : undefined;
      const story = typeof storyValue === 'string' ? storyValue : undefined;
      return {
        item,
        position,
        sortKey:
          (story !== undefined ? indexByStory.get(story) : undefined) ??
          UNKNOWN_STORY_SORT_INDEX,
      };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.position - b.position)
    .map((entry) => entry.item);
};
