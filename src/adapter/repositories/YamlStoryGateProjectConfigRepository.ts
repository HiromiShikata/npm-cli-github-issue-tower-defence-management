import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { isRecord } from '../../domain/usecases/isRecord';
import {
  StoryGateProjectConfig,
  StoryGateProjectConfigRepository,
} from '../../domain/usecases/adapter-interfaces/StoryGateProjectConfigRepository';

const PROJECT_CONFIG_FILE_PATTERN = /\.config\.ya?ml$/;

export class YamlStoryGateProjectConfigRepository implements StoryGateProjectConfigRepository {
  constructor(private readonly configDirectory: string) {}

  listProjectConfigs = async (): Promise<StoryGateProjectConfig[]> => {
    const fileNames = (await fs.promises.readdir(this.configDirectory))
      .filter((fileName) => PROJECT_CONFIG_FILE_PATTERN.test(fileName))
      .sort();
    const configs: StoryGateProjectConfig[] = [];
    for (const fileName of fileNames) {
      const filePath = path.join(this.configDirectory, fileName);
      const parsed: unknown = YAML.parse(
        await fs.promises.readFile(filePath, 'utf8'),
      );
      const org = isRecord(parsed) ? parsed.org : undefined;
      const agents = isRecord(parsed) ? parsed.agents : undefined;
      if (typeof org !== 'string' || org === '') {
        continue;
      }
      configs.push({
        filePath,
        org,
        agents: Array.isArray(agents)
          ? agents.filter((agent): agent is string => typeof agent === 'string')
          : [],
      });
    }
    return configs;
  };
}
