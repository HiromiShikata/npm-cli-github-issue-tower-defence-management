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

describe('loadConfigFile consoleProjectConfigDirectory', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-project-config-dir-'),
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

  it('parses consoleProjectConfigDirectory from the config file', () => {
    const filePath = writeConfig(
      "projectName: 'demo'\nconsoleProjectConfigDirectory: '/home/user/.config/tdpm/project-configs'\n",
    );
    expect(loadConfigFile(filePath).consoleProjectConfigDirectory).toBe(
      '/home/user/.config/tdpm/project-configs',
    );
  });

  it('yields undefined consoleProjectConfigDirectory when the key is absent', () => {
    const filePath = writeConfig("projectName: 'demo'\n");
    expect(
      loadConfigFile(filePath).consoleProjectConfigDirectory,
    ).toBeUndefined();
  });
});

describe('mergeConfigs consoleProjectConfigDirectory', () => {
  it('prefers the cli override consoleProjectConfigDirectory over the config file value', () => {
    const merged = mergeConfigs(
      { consoleProjectConfigDirectory: '/config-dir' },
      { consoleProjectConfigDirectory: '/cli-dir' },
      {},
    );
    expect(merged.consoleProjectConfigDirectory).toBe('/cli-dir');
  });

  it('falls back to the config file consoleProjectConfigDirectory when no cli override is present', () => {
    const merged = mergeConfigs(
      { consoleProjectConfigDirectory: '/config-dir' },
      {},
      {},
    );
    expect(merged.consoleProjectConfigDirectory).toBe('/config-dir');
  });

  it('yields undefined consoleProjectConfigDirectory when neither source provides it', () => {
    expect(
      mergeConfigs({}, {}, {}).consoleProjectConfigDirectory,
    ).toBeUndefined();
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

  it('yields undefined consoleGithubTokens when an entry is not a string or the value is a list', () => {
    const invalidTokenCases: { name: string; content: string }[] = [
      {
        name: 'an entry that is not a string',
        content: [
          'consoleGithubTokens:',
          "  acme: 'token-abc'",
          '  other: 123',
        ].join('\n'),
      },
      {
        name: 'a list',
        content: ['consoleGithubTokens:', "  - 'token-abc'"].join('\n'),
      },
    ];

    const observed = invalidTokenCases.map((invalidTokenCase) => ({
      name: invalidTokenCase.name,
      consoleGithubTokens: loadConfigFile(writeConfig(invalidTokenCase.content))
        .consoleGithubTokens,
    }));

    expect(observed).toEqual(
      invalidTokenCases.map((invalidTokenCase) => ({
        name: invalidTokenCase.name,
        consoleGithubTokens: undefined,
      })),
    );
  });
});

describe('loadConfigFile consoleProjects', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-projects-'),
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

  it('parses the consoleProjects map and yields undefined when it is absent, a list, or holds an entry that is not a string', () => {
    const consoleProjectsCases: {
      name: string;
      content: string;
      expectedConsoleProjects: Record<string, string> | undefined;
    }[] = [
      {
        name: 'a map of project urls',
        content: [
          'consoleProjects:',
          "  umino: 'https://github.com/users/HiromiShikata/projects/1'",
          "  acme: 'https://github.com/orgs/acme-labs/projects/2'",
        ].join('\n'),
        expectedConsoleProjects: {
          umino: 'https://github.com/users/HiromiShikata/projects/1',
          acme: 'https://github.com/orgs/acme-labs/projects/2',
        },
      },
      {
        name: 'absent',
        content: "projectName: 'demo'\n",
        expectedConsoleProjects: undefined,
      },
      {
        name: 'a list',
        content: [
          'consoleProjects:',
          "  - 'https://github.com/users/HiromiShikata/projects/1'",
        ].join('\n'),
        expectedConsoleProjects: undefined,
      },
      {
        name: 'an entry that is not a string',
        content: [
          'consoleProjects:',
          "  umino: 'https://github.com/users/HiromiShikata/projects/1'",
          '  acme: 2',
        ].join('\n'),
        expectedConsoleProjects: undefined,
      },
    ];

    const observed = consoleProjectsCases.map((consoleProjectsCase) => ({
      name: consoleProjectsCase.name,
      consoleProjects: loadConfigFile(writeConfig(consoleProjectsCase.content))
        .consoleProjects,
    }));

    expect(observed).toEqual(
      consoleProjectsCases.map((consoleProjectsCase) => ({
        name: consoleProjectsCase.name,
        consoleProjects: consoleProjectsCase.expectedConsoleProjects,
      })),
    );
  });
});

const UNRESOLVED_TAG_CONFIG_CONTENT =
  'consoleProjects:\n  umino: https://github.com/orgs/org-a/projects/1\nconsoleGithubTokens:\n  umino: !foo FAKE_SECRET_VALUE_123\n';
const FAKE_SECRET_VALUE = 'FAKE_SECRET_VALUE_123';
const YAML_WARNING_NAME = 'YAMLWarning';
const UNRESOLVED_TAG_DIAGNOSTIC_CODE = 'TAG_RESOLVE_FAILED';
const SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_CONTENT = [
  'consoleGithubTokens: {',
  '  umino: FAKE_SECRET_VALUE_123 x',
  '',
].join('\n');

const UNRESOLVED_ALIAS_CONFIG_CONTENT =
  'consoleGithubTokens:\n  umino: *FAKE_SECRET_VALUE_123\n';

const printedTextOf = (printedValues: unknown[]): string =>
  printedValues.map(String).join(' ');

const warningTextOf = (warning: unknown): string => {
  const code =
    typeof warning === 'object' && warning !== null && 'code' in warning
      ? String(warning.code)
      : '';
  return `${code} ${String(warning)}`;
};

describe('loadConfigFile unresolved YAML tag', () => {
  let dir: string;
  let emitWarningSpy: jest.SpyInstance;
  let stderrWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-unresolved-tag-'),
    );
    emitWarningSpy = jest
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined);
    stderrWriteSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
  });

  afterEach(() => {
    emitWarningSpy.mockRestore();
    stderrWriteSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the consoleGithubTokens key and writes no YAML warning or token value to stderr', async () => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, UNRESOLVED_TAG_CONFIG_CONTENT);

    const config = loadConfigFile(filePath);
    await new Promise((resolve) => setImmediate(resolve));

    const stderrText = stderrWriteSpy.mock.calls
      .map(([chunk]) => String(chunk))
      .join('');
    const warningTextsWithLeak = emitWarningSpy.mock.calls
      .map(([warning]) => String(warning))
      .filter(
        (text) =>
          text.includes(YAML_WARNING_NAME) || text.includes(FAKE_SECRET_VALUE),
      );

    expect(config.consoleGithubTokens).toHaveProperty(['umino']);
    expect(stderrText).not.toContain(FAKE_SECRET_VALUE);
    expect(stderrText).not.toContain(YAML_WARNING_NAME);
    expect(warningTextsWithLeak).toEqual([]);
  });
});

describe('loadConfigFile unresolved YAML tag diagnostic', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-unresolved-tag-diagnostic-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a diagnostic naming the tag line, column and TAG_RESOLVE_FAILED code to stderr, with no token value or YAMLWarning name', async () => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, UNRESOLVED_TAG_CONFIG_CONTENT);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const stderrWriteSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const emitWarningSpy = jest
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined);

    loadConfigFile(filePath);
    await new Promise((resolve) => setImmediate(resolve));

    const stderrText = [
      ...consoleErrorSpy.mock.calls.map(printedTextOf),
      ...consoleWarnSpy.mock.calls.map(printedTextOf),
      ...stderrWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ...emitWarningSpy.mock.calls.map(([warning]) => warningTextOf(warning)),
    ].join('\n');

    expect(stderrText).toContain(UNRESOLVED_TAG_DIAGNOSTIC_CODE);
    expect(stderrText).toMatch(/\bline 4\b/);
    expect(stderrText).toMatch(/\bcolumn 10\b/);
    expect(stderrText).not.toContain(FAKE_SECRET_VALUE);
    expect(stderrText).not.toContain(YAML_WARNING_NAME);
  });
});

describe('loadConfigFile YAML parsing outcomes', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-yaml-outcomes-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const writeConfig = (content: string): string => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, content);
    return filePath;
  };

  it('returns an empty config when the file root is not a mapping', () => {
    const notMappingCases = [
      { name: 'a sequence', content: '- token-a\n- token-b\n' },
      { name: 'a scalar', content: 'token-a\n' },
    ];

    const observed = notMappingCases.map(({ name, content }) => ({
      name,
      config: loadConfigFile(writeConfig(content)),
    }));

    expect(observed).toEqual(
      notMappingCases.map(({ name }) => ({ name, config: {} })),
    );
  });

  it('reports a syntax error at line 3, column 3 through console.error and exits 1', () => {
    const syntaxErrorContent = [
      'consoleProjects: {',
      "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
      '  pj-b: token-a x',
      '',
    ].join('\n');
    const filePath = writeConfig(syntaxErrorContent);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((): never => {
        throw new Error('process.exit called');
      });

    expect(() => loadConfigFile(filePath)).toThrow('process.exit called');
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to load configuration file "${filePath}": `,
      ),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('at line 3, column 3'),
    );
  });

  it('returns the value of a tagged entry as a plain string without the tag', () => {
    jest.spyOn(process, 'emitWarning').mockImplementation(() => undefined);

    const config = loadConfigFile(writeConfig(UNRESOLVED_TAG_CONFIG_CONTENT));

    expect(config.consoleGithubTokens).toEqual({
      umino: FAKE_SECRET_VALUE,
    });
  });

  it('prints the syntax error location without the source line, writes no token value to stdout or stderr, and exits 1 when the syntax error sits on a token line', () => {
    const filePath = writeConfig(SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_CONTENT);
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrWriteSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const emitWarningSpy = jest
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined);
    const processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((): never => {
        throw new Error('process.exit called');
      });

    expect(() => loadConfigFile(filePath)).toThrow('process.exit called');

    const errorMessage = printedTextOf(consoleErrorSpy.mock.calls[0] ?? []);
    const outputText = [
      ...consoleLogSpy.mock.calls.map(printedTextOf),
      ...consoleErrorSpy.mock.calls.map(printedTextOf),
      ...consoleWarnSpy.mock.calls.map(printedTextOf),
      ...stdoutWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ...stderrWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ...emitWarningSpy.mock.calls.map(([warning]) => warningTextOf(warning)),
    ].join('\n');
    const expectedMessagePrefix = `Failed to load configuration file "${filePath}": `;

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(errorMessage.slice(0, expectedMessagePrefix.length)).toBe(
      expectedMessagePrefix,
    );
    expect(errorMessage).toMatch(/\bline 3\b/);
    expect(errorMessage).toMatch(/\bcolumn 1\b/);
    expect(outputText).not.toContain(FAKE_SECRET_VALUE);
  });
});

describe('loadConfigFile unresolved alias', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-unresolved-alias-'),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the Unresolved alias message without the alias name to stdout or stderr and exits 1 when a consoleGithubTokens entry is an undefined alias', () => {
    const filePath = path.join(dir, 'config.yml');
    fs.writeFileSync(filePath, UNRESOLVED_ALIAS_CONFIG_CONTENT);
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const stdoutWriteSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrWriteSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const emitWarningSpy = jest
      .spyOn(process, 'emitWarning')
      .mockImplementation(() => undefined);
    const processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((): never => {
        throw new Error('process.exit called');
      });

    expect(() => loadConfigFile(filePath)).toThrow('process.exit called');

    const errorMessage = printedTextOf(consoleErrorSpy.mock.calls[0] ?? []);
    const outputText = [
      ...consoleLogSpy.mock.calls.map(printedTextOf),
      ...consoleErrorSpy.mock.calls.map(printedTextOf),
      ...consoleWarnSpy.mock.calls.map(printedTextOf),
      ...stdoutWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ...stderrWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ...emitWarningSpy.mock.calls.map(([warning]) => warningTextOf(warning)),
    ].join('\n');
    const expectedMessagePrefix = `Failed to load configuration file "${filePath}": `;

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(errorMessage.slice(0, expectedMessagePrefix.length)).toBe(
      expectedMessagePrefix,
    );
    expect(errorMessage).toContain('Unresolved alias');
    expect(outputText).not.toContain(FAKE_SECRET_VALUE);
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

  it('yields undefined when githubAppPrivateKeyPaths is a map of project key paths', () => {
    const filePath = writeConfig(
      [
        'githubAppPrivateKeyPaths:',
        '  umino:',
        "    - '/keys/umino-private-key.pem'",
      ].join('\n'),
    );
    expect(loadConfigFile(filePath).githubAppPrivateKeyPaths).toBeUndefined();
  });
});

describe('loadConfigFile consoleGithubAppPrivateKeyPaths', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'project-config-console-github-app-keys-'),
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

  it('parses the per console project key path lists, omitting every entry that is not a list of strings, and yields undefined when nothing usable remains', () => {
    const keyPathsCases: {
      name: string;
      content: string;
      expectedConsoleGithubAppPrivateKeyPaths:
        Record<string, string[]> | undefined;
    }[] = [
      {
        name: 'a map of key path lists',
        content: [
          'consoleGithubAppPrivateKeyPaths:',
          '  umino:',
          "    - '/keys/umino-private-key.pem'",
          '  other:',
          "    - '/keys/other-first-private-key.pem'",
          "    - '/keys/other-second-private-key.pem'",
        ].join('\n'),
        expectedConsoleGithubAppPrivateKeyPaths: {
          umino: ['/keys/umino-private-key.pem'],
          other: [
            '/keys/other-first-private-key.pem',
            '/keys/other-second-private-key.pem',
          ],
        },
      },
      {
        name: 'entries that are not a list of strings are omitted',
        content: [
          'consoleGithubAppPrivateKeyPaths:',
          '  umino:',
          "    - '/keys/umino-private-key.pem'",
          '  numbers:',
          '    - 1',
          '    - 2',
          "  scalar: '/keys/scalar-private-key.pem'",
          '  mixed:',
          "    - '/keys/mixed-private-key.pem'",
          '    - 3',
          '  nested:',
          '    inner:',
          "      - '/keys/nested-private-key.pem'",
        ].join('\n'),
        expectedConsoleGithubAppPrivateKeyPaths: {
          umino: ['/keys/umino-private-key.pem'],
        },
      },
      {
        name: 'a list',
        content: [
          'consoleGithubAppPrivateKeyPaths:',
          "  - '/keys/umino-private-key.pem'",
        ].join('\n'),
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'a string',
        content:
          "consoleGithubAppPrivateKeyPaths: '/keys/umino-private-key.pem'",
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'a number',
        content: 'consoleGithubAppPrivateKeyPaths: 42',
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'null',
        content: 'consoleGithubAppPrivateKeyPaths:',
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'every entry is invalid',
        content: [
          'consoleGithubAppPrivateKeyPaths:',
          '  umino: 1',
          '  other:',
          '    - 2',
        ].join('\n'),
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'an empty map',
        content: 'consoleGithubAppPrivateKeyPaths: {}',
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
      {
        name: 'absent',
        content: "projectName: 'demo'\n",
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
    ];

    const observed = keyPathsCases.map((keyPathsCase) => ({
      name: keyPathsCase.name,
      consoleGithubAppPrivateKeyPaths: loadConfigFile(
        writeConfig(keyPathsCase.content),
      ).consoleGithubAppPrivateKeyPaths,
    }));

    expect(observed).toEqual(
      keyPathsCases.map((keyPathsCase) => ({
        name: keyPathsCase.name,
        consoleGithubAppPrivateKeyPaths:
          keyPathsCase.expectedConsoleGithubAppPrivateKeyPaths,
      })),
    );
  });

  it('leaves the top-level githubAppPrivateKeyPaths as written while parsing consoleGithubAppPrivateKeyPaths', () => {
    const coexistenceCases: {
      name: string;
      content: string;
      expectedGithubAppPrivateKeyPaths: string[] | undefined;
      expectedConsoleGithubAppPrivateKeyPaths:
        Record<string, string[]> | undefined;
    }[] = [
      {
        name: 'both keys are set',
        content: [
          'githubAppPrivateKeyPaths:',
          "  - '/keys/top-level-private-key.pem'",
          'consoleGithubAppPrivateKeyPaths:',
          '  umino:',
          "    - '/keys/umino-private-key.pem'",
        ].join('\n'),
        expectedGithubAppPrivateKeyPaths: ['/keys/top-level-private-key.pem'],
        expectedConsoleGithubAppPrivateKeyPaths: {
          umino: ['/keys/umino-private-key.pem'],
        },
      },
      {
        name: 'only the console map is set',
        content: [
          'consoleGithubAppPrivateKeyPaths:',
          '  umino:',
          "    - '/keys/umino-private-key.pem'",
        ].join('\n'),
        expectedGithubAppPrivateKeyPaths: undefined,
        expectedConsoleGithubAppPrivateKeyPaths: {
          umino: ['/keys/umino-private-key.pem'],
        },
      },
      {
        name: 'the console value is a list',
        content: [
          'githubAppPrivateKeyPaths:',
          "  - '/keys/top-level-private-key.pem'",
          'consoleGithubAppPrivateKeyPaths:',
          "  - '/keys/umino-private-key.pem'",
        ].join('\n'),
        expectedGithubAppPrivateKeyPaths: ['/keys/top-level-private-key.pem'],
        expectedConsoleGithubAppPrivateKeyPaths: undefined,
      },
    ];

    const observed = coexistenceCases.map((coexistenceCase) => {
      const loaded = loadConfigFile(writeConfig(coexistenceCase.content));
      return {
        name: coexistenceCase.name,
        githubAppPrivateKeyPaths: loaded.githubAppPrivateKeyPaths,
        consoleGithubAppPrivateKeyPaths: loaded.consoleGithubAppPrivateKeyPaths,
      };
    });

    expect(observed).toEqual(
      coexistenceCases.map((coexistenceCase) => ({
        name: coexistenceCase.name,
        githubAppPrivateKeyPaths:
          coexistenceCase.expectedGithubAppPrivateKeyPaths,
        consoleGithubAppPrivateKeyPaths:
          coexistenceCase.expectedConsoleGithubAppPrivateKeyPaths,
      })),
    );
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
    expect(diskWriteCall?.[1]).toEqual({
      fetchedAtMs: baseNowMs,
      readme: null,
    });
  });

  it('fetches fresh and updates cache when disk cache entry is present but beyond TTL', async () => {
    const staleFetchedAt = baseNowMs - PROJECT_README_CACHE_TTL_MS - 1;
    const freshReadme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 7</details>';
    mockCacheRepo.getSingle.mockImplementation(async (key: string) => {
      if (key.startsWith('projectReadme/')) {
        return { fetchedAtMs: staleFetchedAt, readme: 'stale content' };
      }
      return null;
    });
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeReadmeResponse(freshReadme));

    const result = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );

    expect(result).toBe(freshReadme);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const diskWriteCall = mockCacheRepo.setSingle.mock.calls.find(([key]) =>
      key.startsWith('projectReadme/'),
    );
    expect(diskWriteCall).toBeDefined();
    expect(diskWriteCall?.[1]).toEqual({
      fetchedAtMs: baseNowMs,
      readme: freshReadme,
    });
  });

  it('returns the fetched readme even when the cache write throws', async () => {
    const readme =
      '<details><summary>config</summary>maximumPreparingIssuesCount: 2</details>';
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(makeReadmeResponse(readme));
    mockCacheRepo.setSingle.mockRejectedValueOnce(new Error('disk full'));

    const result = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs,
    );

    expect(result).toBe(readme);

    const result2 = await fetchProjectReadmeWithCache(
      projectUrl,
      token,
      mockCacheRepo,
      baseNowMs + 1,
    );

    expect(result2).toBe(readme);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
