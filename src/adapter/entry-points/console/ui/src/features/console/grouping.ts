import type { ConsoleColor, ConsoleListItem } from './types';

export const NO_STORY_LABEL = '(No story)';

export type ConsoleStoryGroup = {
  story: string;
  color: ConsoleColor;
  items: ConsoleListItem[];
};

const resolveStoryName = (item: ConsoleListItem): string => {
  const trimmed = item.story.trim();
  return trimmed === '' ? NO_STORY_LABEL : trimmed;
};

const resolveStoryColor = (
  story: string,
  storyColors: Record<string, ConsoleColor>,
): ConsoleColor => storyColors[story] ?? 'GRAY';

export const groupItemsByStoryOrder = (
  items: ConsoleListItem[],
  storyColors: Record<string, ConsoleColor>,
): ConsoleStoryGroup[] => {
  const groups: ConsoleStoryGroup[] = [];
  for (const item of items) {
    const story = resolveStoryName(item);
    const lastGroup = groups.at(-1);
    if (lastGroup !== undefined && lastGroup.story === story) {
      lastGroup.items.push(item);
      continue;
    }
    groups.push({
      story,
      color: resolveStoryColor(story, storyColors),
      items: [item],
    });
  }
  return groups;
};
