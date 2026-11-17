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
      {
        filePath: secondPath,
        org: 'Another-Org',
        agents: [],
        projectUrl: 'https://github.com/orgs/another-org/projects/1',
      },
    ]);
  });

  it.each([
    {
      case: 'a repositories list is read with its projectUrl',
      content:
        'org: example-org\nprojectUrl: https://github.com/users/example-org/projects/1\nrepositories:\n  - example-org/example-tasks\n  - Example-Org/other-repo\n',
      expected: {
        projectUrl: 'https://github.com/users/example-org/projects/1',
        repositories: ['example-org/example-tasks', 'Example-Org/other-repo'],
      },
    },
    {
      case: 'an absent repositories key is read as undefined, not an empty list',
      content: 'org: example-org\nagents:\n  - developer-agent\n',
      expected: { projectUrl: undefined, repositories: undefined },
    },
  ])('$case', async ({ content, expected }) => {
    configWrite('delta.config.yml', content);

    const [config] = await new YamlStoryGateProjectConfigRepository(
      configDirectory,
    ).listProjectConfigs();

    expect(config.projectUrl).toBe(expected.projectUrl);
    expect(config.repositories).toEqual(expected.repositories);
  });

  it.each([
    {
      case: 'a repositories value that is not a list',
      content: 'org: example-org\nrepositories: example-org/example-tasks\n',
    },
    {
      case: 'an entry that is not owner/repo',
      content: 'org: example-org\nrepositories:\n  - example-tasks\n',
    },
    {
      case: 'an entry that is not a string',
      content: 'org: example-org\nrepositories:\n  - 42\n',
    },
  ])(
    'rejects a malformed repositories key with $case, naming the file',
    async ({ content }) => {
      const filePath = configWrite('epsilon.config.yml', content);

      await expect(
        new YamlStoryGateProjectConfigRepository(
          configDirectory,
        ).listProjectConfigs(),
      ).rejects.toThrow(filePath);
    },
  );
});
