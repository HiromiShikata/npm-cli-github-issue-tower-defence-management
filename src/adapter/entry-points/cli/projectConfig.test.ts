import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadConfigFile,
  mergeConfigs,
  parseProjectReadmeConfig,
  setProjectReadmeMaxPreparingIssuesCount,
  fetchProjectReadmeWithCache,
  PROJECT_README_CACHE_TTL_MS,
  resetProjectReadmeInMemoryCacheForTesting,
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

describe('loadConfigFile consoleGithubTokens', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-github-tokens-'),
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

  it('parses consoleGithubTokens map from the config file', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\nconsoleGithubTokens:\n  acme: 'token-abc'\n  other: 'token-xyz'\n",
    );
    expect(loadConfigFile(filePath).consoleGithubTokens).toEqual({
      acme: 'token-abc',
      other: 'token-xyz',
    });
  });

  it('yields undefined consoleGithubTokens when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).consoleGithubTokens).toBeUndefined();
  });
});

describe('mergeConfigs consoleGithubTokens', () => {
  it('prefers the cli override consoleGithubTokens over the config file value', () => {
    const merged = mergeConfigs(
      { consoleGithubTokens: { acme: 'config-token' } },
      { consoleGithubTokens: { acme: 'cli-token' } },
      {},
    );
    expect(merged.consoleGithubTokens).toEqual({ acme: 'cli-token' });
  });

  it('falls back to the config file consoleGithubTokens when no cli override is present', () => {
    const merged = mergeConfigs(
      { consoleGithubTokens: { acme: 'config-token' } },
      {},
      {},
    );
    expect(merged.consoleGithubTokens).toEqual({ acme: 'config-token' });
  });

  it('yields undefined consoleGithubTokens when neither source provides it', () => {
    expect(mergeConfigs({}, {}, {}).consoleGithubTokens).toBeUndefined();
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

const makeReadmeWith = (yaml: string): string =>
  `# Project\n<details>\n<summary>config</summary>\n${yaml}\n</details>\n`;

describe('setProjectReadmeMaxPreparingIssuesCount', () => {
  it('sets maximumPreparingIssuesCount in an existing config block', () => {
    const readme = makeReadmeWith('maximumPreparingIssuesCount: 3\n');
    const result = setProjectReadmeMaxPreparingIssuesCount(readme, 7);
    expect(parseProjectReadmeConfig(result).maximumPreparingIssuesCount).toBe(
      7,
    );
  });

  it('adds maximumPreparingIssuesCount when the key is absent', () => {
    const readme = makeReadmeWith('defaultAgentName: impl\n');
    const result = setProjectReadmeMaxPreparingIssuesCount(readme, 5);
    expect(parseProjectReadmeConfig(result).maximumPreparingIssuesCount).toBe(
      5,
    );
  });

  it('preserves existing config keys when updating', () => {
    const readme = makeReadmeWith(
      'defaultAgentName: impl\nmaximumPreparingIssuesCount: 3\n',
    );
    const result = setProjectReadmeMaxPreparingIssuesCount(readme, 10);
    const config = parseProjectReadmeConfig(result);
    expect(config.maximumPreparingIssuesCount).toBe(10);
    expect(config.defaultAgentName).toBe('impl');
  });

  it('appends a new config block when none exists', () => {
    const readme = '# Project\nSome description.\n';
    const result = setProjectReadmeMaxPreparingIssuesCount(readme, 4);
    expect(parseProjectReadmeConfig(result).maximumPreparingIssuesCount).toBe(
      4,
    );
  });
});

describe('loadConfigFile githubAppPrivateKeyPaths', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-github-app-keys-'),
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

  it('yields undefined when githubAppPrivateKeyPaths is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(loadConfigFile(filePath).githubAppPrivateKeyPaths).toBeUndefined();
  });

  it('parses a list of GitHub App private key paths', () => {
    const filePath = writeConfig(
      [
        "projectName: 'demo'",
        'githubAppPrivateKeyPaths:',
        "  - '/home/hiromi/.config/secretary/creds/hs-bot-gh-app-private-key.pem'",
      ].join('\n'),
    );
    expect(loadConfigFile(filePath).githubAppPrivateKeyPaths).toEqual([
      '/home/hiromi/.config/secretary/creds/hs-bot-gh-app-private-key.pem',
    ]);
  });

  it('yields undefined when githubAppPrivateKeyPaths contains a non-string entry', () => {
    const filePath = writeConfig(
      ['githubAppPrivateKeyPaths:', '  - 123'].join('\n'),
    );
    expect(loadConfigFile(filePath).githubAppPrivateKeyPaths).toBeUndefined();
  });
});

describe('mergeConfigs githubAppPrivateKeyPaths', () => {
  it('takes the array from the config file when no cli override is present', () => {
    const merged = mergeConfigs(
      { githubAppPrivateKeyPaths: ['/path/key1.pem', '/path/key2.pem'] },
      {},
      {},
    );
    expect(merged.githubAppPrivateKeyPaths).toEqual([
      '/path/key1.pem',
      '/path/key2.pem',
    ]);
  });

  it('prefers the cli override array over the config file array', () => {
    const merged = mergeConfigs(
      { githubAppPrivateKeyPaths: ['/path/key1.pem'] },
      { githubAppPrivateKeyPaths: ['/path/key2.pem', '/path/key3.pem'] },
      {},
    );
    expect(merged.githubAppPrivateKeyPaths).toEqual([
      '/path/key2.pem',
      '/path/key3.pem',
    ]);
  });

  it('yields undefined when neither source provides the array', () => {
    expect(mergeConfigs({}, {}, {}).githubAppPrivateKeyPaths).toBeUndefined();
  });
});

describe('fetchProjectReadmeWithCache', () => {
  const mockCacheRepo = {
    getSingle: jest.fn<Promise<unknown>, [string]>(),
    setSingle: jest.fn<Promise<void>, [string, unknown]>(),
  };
  const projectUrl = 'https://github.com/users/TestOrg/projects/1';
  const token = 'test-token';
  const baseNowMs = new Date('2026-01-01T00:00:00.000Z').getTime();

  const makeReadmeResponse = (readme: string | null): Response =>
    new Response(
      JSON.stringify(
        readme === null
          ? { data: {} }
          : { data: { organization: { projectV2: { readme } } } },
      ),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    resetProjectReadmeInMemoryCacheForTesting();
    mockCacheRepo.getSingle.mockResolvedValue(null);
    mockCacheRepo.setSingle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches from API and writes to both caches on the first call', async () => {
    const readme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 5</details>';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeReadmeResponse(readme));

    const result = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );

    expect(result).toBe(readme);
    const diskWriteCall = mockCacheRepo.setSingle.mock.calls.find(([key]) =>
      key.startsWith('projectReadme/'),
    );
    expect(diskWriteCall).toBeDefined();
    expect(diskWriteCall?.[1]).toEqual({ fetchedAtMs: baseNowMs, readme });
  });

  it('does not call the API for a second call within the TTL (in-memory cache hit)', async () => {
    const readme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 5</details>';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeReadmeResponse(readme));

    await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );
    await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs + PROJECT_README_CACHE_TTL_MS - 1,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('calls the API again after the TTL has expired', async () => {
    const readme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 5</details>';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(makeReadmeResponse(readme));

    await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );
    await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs + PROJECT_README_CACHE_TTL_MS + 1,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('serves from disk cache without API call when disk cache is within TTL', async () => {
    const diskReadme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 3</details>';
    const diskFetchedAtMs = baseNowMs - (PROJECT_README_CACHE_TTL_MS - 60000);
    mockCacheRepo.getSingle.mockImplementation(async (key: string) => {
      if (key.startsWith('projectReadme/')) {
        return { fetchedAtMs: diskFetchedAtMs, readme: diskReadme };
      }
      return null;
    });
    const fetchSpy = jest.spyOn(global, 'fetch');

    const result = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );

    expect(result).toBe(diskReadme);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null without error for a project that has no README override', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(makeReadmeResponse(null));

    const result = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );

    expect(result).toBeNull();
    const diskWriteCall = mockCacheRepo.setSingle.mock.calls.find(([key]) =>
      key.startsWith('projectReadme/'),
    );
    expect(diskWriteCall).toBeDefined();
    expect(diskWriteCall?.[1]).toEqual({ fetchedAtMs: baseNowMs, readme: null });
  });
});
