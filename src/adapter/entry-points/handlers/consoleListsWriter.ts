import fs from 'fs';
import path from 'path';
import type { Issue } from '../../../domain/entities/Issue';
import type { Project } from '../../../domain/entities/Project';
import {
  ConsoleLists,
  ConsoleTabName,
  GenerateConsoleListsUseCase,
} from '../../../domain/usecases/console/GenerateConsoleListsUseCase';
import { resetDoneProjectItemIdsAcrossTabs } from '../console/consoleDoneStore';

export type ConsoleListsWriterParams = {
  consoleDataOutputDir: string | null | undefined;
  pjcode: string | null | undefined;
  assigneeLogin: string | null | undefined;
  project: Project;
  issues: Issue[];
  workflowBlockerStoryName?: string | null | undefined;
  generatedAt?: string;
};

const CONSOLE_TAB_NAMES: ConsoleTabName[] = [
  'workflow-blocker',
  'prs',
  'triage',
  'unread',
  'failed-preparation',
  'todo-by-human',
  'todo-by-agent',
];

export const formatConsoleGeneratedAt = (date: Date): string =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z');

const writeJsonAtomic = (filePath: string, data: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, filePath);
};

export const writeConsoleLists = (params: ConsoleListsWriterParams): void => {
  const { consoleDataOutputDir, pjcode, assigneeLogin } = params;
  if (!consoleDataOutputDir || !pjcode || !assigneeLogin) {
    return;
  }

  const generatedAt =
    params.generatedAt ?? formatConsoleGeneratedAt(new Date());
  const lists: ConsoleLists = new GenerateConsoleListsUseCase().run({
    project: params.project,
    issues: params.issues,
    pjcode,
    assigneeLogin,
    generatedAt,
    workflowBlockerStoryName: params.workflowBlockerStoryName ?? null,
  });

  for (const tab of CONSOLE_TAB_NAMES) {
    writeJsonAtomic(
      path.join(consoleDataOutputDir, pjcode, tab, 'list.json'),
      lists[tab],
    );
  }

  resetDoneProjectItemIdsAcrossTabs(consoleDataOutputDir, pjcode);
};
