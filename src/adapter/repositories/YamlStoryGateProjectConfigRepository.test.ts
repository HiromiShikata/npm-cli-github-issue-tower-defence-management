import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { YamlStoryGateProjectConfigRepository } from './YamlStoryGateProjectConfigRepository';

describe('YamlStoryGateProjectConfigRepository', () => {
  let configDirectory: string;

  beforeEach(() => {
    configDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-config-'),
    );
  });

  afterEach(() => {
    fs.rmSync(configDirectory, { recursive: true, force: true });
  });

  const configWrite = (fileName: string, content: string): string => {
    const filePath = path.join(configDirectory, fileName);
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('reads org and agents from every project config file', async () => {
    const firstPath = configWrite(
      'alpha.config.yaml',
      'org: example-org\nagents:\n  - developer-agent\n  - triage-agent\n',
    );
    const secondPath = configWrite(
      'beta.config.yml',
      'org: Another-Org\nprojectUrl: https://github.com/orgs/another-org/projects/1\n',
    );
    configWrite('notes.yaml', 'org: ignored-org\nagents:\n  - ignored\n');
    configWrite('gamma.config.yaml', 'agents:\n  - orphan-agent\n');

    const configs = await new YamlStoryGateProjectConfigRepository(
      configDirectory,
    ).listProjectConfigs();

    expect(configs).toEqual([
      {
        filePath: firstPath,
        org: 'example-org',
        agents: ['developer-agent', 'triage-agent'],
      },
      { filePath: secondPath, org: 'Another-Org', agents: [] },
    ]);
  });
});
