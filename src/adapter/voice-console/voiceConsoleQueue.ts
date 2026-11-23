import * as fs from 'fs';
import * as path from 'path';
import type {
  ConsoleFieldOption,
  ConsoleListItem,
} from '../../domain/usecases/console/GenerateConsoleListsUseCase';

export const VOICE_CONSOLE_QUEUE_TABS = ['todo-by-human', 'prs'] as const;

export type VoiceConsoleQueueTab = (typeof VOICE_CONSOLE_QUEUE_TABS)[number];

export type VoiceConsoleQueueEntry = {
  pjcode: string;
  tab: VoiceConsoleQueueTab;
  item: ConsoleListItem;
  statusOptions: ConsoleFieldOption[];
};

export type BuildVoiceConsoleQueueInput = {
  consoleDataOutputDir: string;
  projectPjcodes: string[];
};

type ConsoleListFile = {
  items: ConsoleListItem[];
  statusOptions: ConsoleFieldOption[];
};

const isConsoleListFile = (value: unknown): value is ConsoleListFile =>
  typeof value === 'object' &&
  value !== null &&
  'items' in value &&
  Array.isArray(value.items) &&
  'statusOptions' in value &&
  Array.isArray(value.statusOptions);

const isNodeErrorWithCode = (error: unknown, code: string): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === code;

const readConsoleListFile = (filePath: string): ConsoleListFile | null => {
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    if (isNodeErrorWithCode(error, 'ENOENT')) {
      return null;
    }
    throw error;
  }
  const parsed: unknown = JSON.parse(content);
  if (!isConsoleListFile(parsed)) {
    throw new Error(
      `console list file has no items or statusOptions: ${filePath}`,
    );
  }
  return parsed;
};

export const buildVoiceConsoleQueue = (
  input: BuildVoiceConsoleQueueInput,
): VoiceConsoleQueueEntry[] => {
  const entries: VoiceConsoleQueueEntry[] = [];
  for (const tab of VOICE_CONSOLE_QUEUE_TABS) {
    for (const pjcode of input.projectPjcodes) {
      const listFile = readConsoleListFile(
        path.join(input.consoleDataOutputDir, pjcode, tab, 'list.json'),
      );
      if (listFile === null) {
        continue;
      }
      for (const item of listFile.items) {
        entries.push({
          pjcode,
          tab,
          item,
          statusOptions: listFile.statusOptions,
        });
      }
    }
  }
  return entries;
};
