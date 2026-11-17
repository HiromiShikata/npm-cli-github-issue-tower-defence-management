import fs from 'node:fs';
import path from 'node:path';
import { ProjectRepositoryScope } from '../../domain/services/projectRepositoryScope';
import {
  PROJECT_CONFIG_FILE_PATTERN,
  storyGateProjectConfigParse,
} from './YamlStoryGateProjectConfigRepository';

export const projectRepositoryScopeLoad = (
  configFilePath: string,
): ProjectRepositoryScope | null => {
  const configDirectory = path.dirname(configFilePath);
  const ownResolvedPath = path.resolve(configFilePath);
  const entries = fs
    .readdirSync(configDirectory)
    .filter(
      (name) =>
        PROJECT_CONFIG_FILE_PATTERN.test(name) ||
        path.resolve(path.join(configDirectory, name)) === ownResolvedPath,
    )
    .sort()
    .flatMap((fileName) => {
      const filePath = path.join(configDirectory, fileName);
      const config = storyGateProjectConfigParse(
        filePath,
        fs.readFileSync(filePath, 'utf8'),
      );
      return config === null
        ? []
        : [{ isOwn: path.resolve(filePath) === ownResolvedPath, config }];
    });
  const own = entries.find((entry) => entry.isOwn)?.config ?? null;
  if (own === null) {
    return null;
  }
  return {
    org: own.org,
    repositories: own.repositories ?? null,
    listedRepositoriesOfOtherProjects: entries.flatMap((entry) =>
      entry.isOwn ? [] : (entry.config.repositories ?? []),
    ),
    ownsUnlistedRepositoriesOfOwner: false,
  };
};
