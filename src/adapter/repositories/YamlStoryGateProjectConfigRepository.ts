import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { isRecord } from '../../domain/usecases/isRecord';
import {
  StoryGateProjectConfig,
  StoryGateProjectConfigRepository,
} from '../../domain/usecases/adapter-interfaces/StoryGateProjectConfigRepository';
import { isRepositoryListEntry } from '../../domain/services/projectRepositoryScope';

export const PROJECT_CONFIG_FILE_PATTERN = /\.config\.ya?ml$/;

// Reads the optional repositories key. Absent means undefined; a value that is
// not a list of owner/repo strings fails loudly, naming the file.
const repositoriesRead = (
  parsed: Record<string, unknown>,
  filePath: string,
): string[] | undefined => {
  const value = parsed.repositories;
  if (value === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(value) ||
    !value.every(
      (entry): entry is string =>
        typeof entry === 'string' && isRepositoryListEntry(entry),
    )
  ) {
    throw new Error(
      `repositories in ${filePath} must be a list of owner/repo strings`,
    );
  }
  return value;
};

// Parses one project config file. A file without a string org is not a
// project config and yields null. A repositories list requires projectUrl,
// because the board cache of the listed project is matched by that URL.
export const storyGateProjectConfigParse = (
  filePath: string,
  content: string,
): StoryGateProjectConfig | null => {
  const parsed: unknown = YAML.parse(content);
  const org = isRecord(parsed) ? parsed.org : undefined;
  if (!isRecord(parsed) || typeof org !== 'string' || org === '') {
    return null;
  }
  const agents = parsed.agents;
  const projectUrl = parsed.projectUrl;
  const repositories = repositoriesRead(parsed, filePath);
  if (repositories !== undefined && typeof projectUrl !== 'string') {
    throw new Error(
      `${filePath} sets repositories and must also set projectUrl, which matches the project's board cache`,
    );
  }
  return {
    filePath,
    org,
    agents: Array.isArray(agents)
      ? agents.filter((agent): agent is string => typeof agent === 'string')
      : [],
    projectUrl: typeof projectUrl === 'string' ? projectUrl : undefined,
    repositories,
  };
};

export class YamlStoryGateProjectConfigRepository implements StoryGateProjectConfigRepository {
  constructor(private readonly configDirectory: string) {}

  listProjectConfigs = async (): Promise<StoryGateProjectConfig[]> => {
    const fileNames = (await fs.promises.readdir(this.configDirectory))
      .filter((fileName) => PROJECT_CONFIG_FILE_PATTERN.test(fileName))
      .sort();
    const configs: StoryGateProjectConfig[] = [];
    for (const fileName of fileNames) {
      const filePath = path.join(this.configDirectory, fileName);
      const config = storyGateProjectConfigParse(
        filePath,
        await fs.promises.readFile(filePath, 'utf8'),
      );
      if (config !== null) {
        configs.push(config);
      }
    }
    return configs;
  };
}
