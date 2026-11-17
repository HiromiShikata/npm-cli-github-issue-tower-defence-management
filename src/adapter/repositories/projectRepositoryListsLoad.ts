import fs from 'node:fs';
import path from 'node:path';
import { projectUrlKeyOf } from '../../domain/services/projectRepositoryScope';
import {
  PROJECT_CONFIG_FILE_PATTERN,
  storyGateProjectConfigParse,
} from './YamlStoryGateProjectConfigRepository';

export const projectRepositoryListsByPjcodeLoad = (
  configDirectory: string | null,
  consoleProjects: Record<string, string> | null,
): Record<string, string[]> | null => {
  if (configDirectory === null || consoleProjects === null) {
    return null;
  }
  const lists: Record<string, string[]> = {};
  const fileNames = fs
    .readdirSync(configDirectory)
    .filter((fileName) => PROJECT_CONFIG_FILE_PATTERN.test(fileName))
    .sort();
  for (const fileName of fileNames) {
    const filePath = path.join(configDirectory, fileName);
    const config = storyGateProjectConfigParse(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
    );
    const repositories = config?.repositories ?? undefined;
    const projectUrl = config?.projectUrl ?? undefined;
    if (repositories === undefined || projectUrl === undefined) {
      continue;
    }
    const pjcode = Object.keys(consoleProjects).find(
      (name) =>
        projectUrlKeyOf(consoleProjects[name]) === projectUrlKeyOf(projectUrl),
    );
    if (pjcode === undefined) {
      continue;
    }
    lists[pjcode] = [...(lists[pjcode] ?? []), ...repositories];
  }
  return lists;
};
