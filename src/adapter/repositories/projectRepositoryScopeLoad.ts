import fs from 'node:fs';
import path from 'node:path';
import { ProjectRepositoryScope } from '../../domain/services/projectRepositoryScope';
import {
  PROJECT_CONFIG_FILE_PATTERN,
  storyGateProjectConfigParse,
} from './YamlStoryGateProjectConfigRepository';

// Builds the repository scope of the project whose config file is given. The
// listed repositories of the sibling project configs in the same directory are
// read so an unlisted project never claims a repository another project lists.
export const projectRepositoryScopeLoad = (
  configFilePath: string,
): ProjectRepositoryScope | null => {
  const own = storyGateProjectConfigParse(
    configFilePath,
    fs.readFileSync(configFilePath, 'utf8'),
  );
  if (own === null) {
    return null;
  }
  const configDirectory = path.dirname(configFilePath);
  const listedRepositoriesOfOtherProjects: string[] = [];
  for (const fileName of fs
    .readdirSync(configDirectory)
    .filter((name) => PROJECT_CONFIG_FILE_PATTERN.test(name))
    .sort()) {
    const siblingPath = path.join(configDirectory, fileName);
    if (path.resolve(siblingPath) === path.resolve(configFilePath)) {
      continue;
    }
    const sibling = storyGateProjectConfigParse(
      siblingPath,
      fs.readFileSync(siblingPath, 'utf8'),
    );
    listedRepositoriesOfOtherProjects.push(...(sibling?.repositories ?? []));
  }
  return {
    org: own.org,
    repositories: own.repositories ?? null,
    listedRepositoriesOfOtherProjects,
  };
};
