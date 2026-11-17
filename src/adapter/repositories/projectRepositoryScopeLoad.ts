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
  const own = storyGateProjectConfigParse(
    configFilePath,
    fs.readFileSync(configFilePath, 'utf8'),
  );
  if (own === null) {
    return null;
  }
  const configDirectory = path.dirname(configFilePath);
  const listedRepositoriesOfOtherProjects: string[] = [];
  const unlistedSiblingOwners: string[] = [];
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
    if (sibling === null) {
      continue;
    }
    const siblingRepositories = sibling.repositories ?? null;
    if (siblingRepositories === null) {
      unlistedSiblingOwners.push(sibling.org);
    } else {
      listedRepositoriesOfOtherProjects.push(...siblingRepositories);
    }
  }
  return {
    org: own.org,
    repositories: own.repositories ?? null,
    listedRepositoriesOfOtherProjects,
    unlistedSiblingOwners,
  };
};
