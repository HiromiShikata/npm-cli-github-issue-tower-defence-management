import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadConfigFile,
  mergeConfigs,
  parseProjectReadmeConfig,
} from './projectConfig';

describe('loadConfigFile disks', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-config-disks-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('parses a disks list of title and mountpoint pairs', () => {
    const filePath = writeConfig(
      [
        "projectName: 'demo'",
        'disks:',
        "  - title: 'D'",
        "    mountpoint: '/'",
        "  - title: 'S'",
        "    mountpoint: '/mountpoint-secondary'",
      ].join('\n'),
    );
    expect(loadConfigFile(filePath).disks).toEqual([
      { title: 'D', mountpoint: '/' },
      { title: 'S', mountpoint: '/mountpoint-secondary' },
    ]);
  });

  it('yields undefined disks when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).disks).toBeUndefined();
  });

  it('yields undefined disks when an entry is missing required fields', () => {
    const filePath = writeConfig(
      ['disks:', "  - title: 'D'"].join('\n') + '\n',
    );
    expect(loadConfigFile(filePath).disks).toBeUndefined();
  });
});

describe('mergeConfigs disks', () => {
  it('prefers cli override disks over the config file disks', () => {
    const merged = mergeConfigs(
      { disks: [{ title: 'D', mountpoint: '/' }] },
      { disks: [{ title: 'C', mountpoint: '/cli' }] },
      {},
    );
    expect(merged.disks).toEqual([{ title: 'C', mountpoint: '/cli' }]);
  });

  it('falls back to the config file disks when no cli override is present', () => {
    const merged = mergeConfigs(
      { disks: [{ title: 'D', mountpoint: '/' }] },
      {},
      {},
    );
    expect(merged.disks).toEqual([{ title: 'D', mountpoint: '/' }]);
  });

  it('yields undefined disks when neither source provides them', () => {
    expect(mergeConfigs({}, {}, {}).disks).toBeUndefined();
  });
});

describe('parseProjectReadmeConfig labelsNotRequiringPullRequest', () => {
  const makeReadme = (yaml: string) =>
    `<details>\n<summary>config</summary>\n${yaml}\n</details>`;

  it('returns labelsNotRequiringPullRequest from the README config section', () => {
    const readme = makeReadme(
      'labelsNotRequiringPullRequest:\n  - chore\n  - accounting\n',
    );
    const result = parseProjectReadmeConfig(readme);
    expect(result.labelsNotRequiringPullRequest).toEqual([
      'chore',
      'accounting',
    ]);
  });

  it('does not emit a warning for labelsNotRequiringPullRequest', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const readme = makeReadme('labelsNotRequiringPullRequest:\n  - chore\n');
    parseProjectReadmeConfig(readme, 'https://example.com/project');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('labelsNotRequiringPullRequest'),
    );
    warnSpy.mockRestore();
  });

  it('yields undefined labelsNotRequiringPullRequest when the key is absent', () => {
    const readme = makeReadme('defaultAgentName: impl\n');
    expect(
      parseProjectReadmeConfig(readme).labelsNotRequiringPullRequest,
    ).toBeUndefined();
  });
});

describe('parseProjectReadmeConfig labelsAsLlmAgentName', () => {
  const makeReadme = (yaml: string) =>
    `<details>\n<summary>config</summary>\n${yaml}\n</details>`;

  it('returns labelsAsLlmAgentName from the README config section', () => {
    const readme = makeReadme(
      'labelsAsLlmAgentName:\n  - chore\n  - accounting\n',
    );
    const result = parseProjectReadmeConfig(readme);
    expect(result.labelsAsLlmAgentName).toEqual(['chore', 'accounting']);
  });

  it('does not emit a warning for labelsAsLlmAgentName', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const readme = makeReadme('labelsAsLlmAgentName:\n  - chore\n');
    parseProjectReadmeConfig(readme, 'https://example.com/project');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('labelsAsLlmAgentName'),
    );
    warnSpy.mockRestore();
  });

  it('yields undefined labelsAsLlmAgentName when the key is absent', () => {
    const readme = makeReadme('defaultAgentName: impl\n');
    expect(
      parseProjectReadmeConfig(readme).labelsAsLlmAgentName,
    ).toBeUndefined();
  });
});

describe('loadConfigFile consoleDataOutputDir', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-data-output-dir-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('parses consoleDataOutputDir from the config file', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\nconsoleDataOutputDir: '/tmp/console-data'\n",
    );
    expect(loadConfigFile(filePath).consoleDataOutputDir).toBe(
      '/tmp/console-data',
    );
  });

  it('yields undefined consoleDataOutputDir when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).consoleDataOutputDir).toBeUndefined();
  });
});

describe('parseProjectReadmeConfig consoleDataOutputDir', () => {
  const makeReadme = (yaml: string) =>
    `<details>\n<summary>config</summary>\n${yaml}\n</details>`;

  it('does not emit a warning for consoleDataOutputDir', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const readme = makeReadme("consoleDataOutputDir: '/tmp/console-data'\n");
    parseProjectReadmeConfig(readme, 'https://example.com/project');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('consoleDataOutputDir'),
    );
    warnSpy.mockRestore();
  });

  it('yields undefined consoleDataOutputDir when the key is absent', () => {
    const readme = makeReadme('defaultAgentName: impl\n');
    expect(
      parseProjectReadmeConfig(readme).consoleDataOutputDir,
    ).toBeUndefined();
  });
});

describe('loadConfigFile consoleGithubTokenFileDir', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-github-token-file-dir-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('parses consoleGithubTokenFileDir from the config file', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\nconsoleGithubTokenFileDir: '/home/user/.config/tdpm'\n",
    );
    expect(loadConfigFile(filePath).consoleGithubTokenFileDir).toBe(
      '/home/user/.config/tdpm',
    );
  });

  it('yields undefined consoleGithubTokenFileDir when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).consoleGithubTokenFileDir).toBeUndefined();
  });
});

describe('mergeConfigs consoleGithubTokenFileDir', () => {
  it('prefers the cli override consoleGithubTokenFileDir over the config file value', () => {
    const merged = mergeConfigs(
      { consoleGithubTokenFileDir: '/config-dir' },
      { consoleGithubTokenFileDir: '/cli-dir' },
      {},
    );
    expect(merged.consoleGithubTokenFileDir).toBe('/cli-dir');
  });

  it('falls back to the config file consoleGithubTokenFileDir when no cli override is present', () => {
    const merged = mergeConfigs(
      { consoleGithubTokenFileDir: '/config-dir' },
      {},
      {},
    );
    expect(merged.consoleGithubTokenFileDir).toBe('/config-dir');
  });

  it('yields undefined consoleGithubTokenFileDir when neither source provides it', () => {
    expect(mergeConfigs({}, {}, {}).consoleGithubTokenFileDir).toBeUndefined();
  });
});

describe('loadConfigFile developerAgentNames', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-developer-agent-names-'),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('parses developerAgentNames array from the config file', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\ndeveloperAgentNames:\n  - my-developer\n  - second-developer\n",
    );
    expect(loadConfigFile(filePath).developerAgentNames).toEqual([
      'my-developer',
      'second-developer',
    ]);
  });

  it('parses legacy developerAgentName string from the config file and wraps it in an array', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\ndeveloperAgentName: 'my-developer'\n",
    );
    expect(loadConfigFile(filePath).developerAgentNames).toEqual([
      'my-developer',
    ]);
  });

  it('yields undefined developerAgentNames when neither key is present', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).developerAgentNames).toBeUndefined();
  });
});

describe('parseProjectReadmeConfig developerAgentNames', () => {
  const makeReadme = (yaml: string) =>
    `<details>\n<summary>config</summary>\n${yaml}\n</details>`;

  it('returns developerAgentNames array from the README config section', () => {
    const readme = makeReadme(
      'developerAgentNames:\n  - my-developer\n  - second-developer\n',
    );
    const result = parseProjectReadmeConfig(readme);
    expect(result.developerAgentNames).toEqual([
      'my-developer',
      'second-developer',
    ]);
  });

  it('returns developerAgentNames from legacy developerAgentName string in README config', () => {
    const readme = makeReadme("developerAgentName: 'my-developer'\n");
    const result = parseProjectReadmeConfig(readme);
    expect(result.developerAgentNames).toEqual(['my-developer']);
  });

  it('does not emit a warning for developerAgentName or developerAgentNames', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const readme = makeReadme("developerAgentName: 'my-developer'\n");
    parseProjectReadmeConfig(readme, 'https://example.com/project');
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('developerAgentName'),
    );
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('developerAgentNames'),
    );
    warnSpy.mockRestore();
  });

  it('yields undefined developerAgentNames when neither key is present', () => {
    const readme = makeReadme('defaultAgentName: impl\n');
    expect(
      parseProjectReadmeConfig(readme).developerAgentNames,
    ).toBeUndefined();
  });
});
