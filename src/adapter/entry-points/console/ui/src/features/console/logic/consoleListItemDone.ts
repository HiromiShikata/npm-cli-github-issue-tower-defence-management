import type { ConsoleListItem } from './types';

export const isConsoleListItemDone = (item: ConsoleListItem): boolean =>
  item.isClosed === true || item.status === 'Done';
