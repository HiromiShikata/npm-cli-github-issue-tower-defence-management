import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { program } from './index';

const DEFAULT_TOKEN = 'test-token';
const CONFIG_FILE_TOKEN_VALUE = 'token-a';
const ISSUE_A_URL = 'https://github.com/org-a/repo-a/issues/1';
const MISSING_CONFIG_FILE_NAME = 'absent-console.yml';
const MALFORMED_CONFIG_FILE_NAME = 'malformed-console.yml';
const MALFORMED_CONFIG_CONTENT = [
  'consoleProjects: {',
  "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
  '  pj-b: token-a x',
  '',
].join('\n');
const TAGGED_MALFORMED_CONFIG_FILE_NAME = 'tagged-malformed-console.yml';
const TAGGED_MALFORMED_CONFIG_CONTENT = [
  'consoleProjects: {',
  "  pj-a: !foo 'https://github.com/orgs/org-a/projects/1'",
  '  pj-b: token-a x',
  '',
].join('\n');
const YAML_TAG_TEXT = '!foo';
const MULTI_DOCUMENT_CONFIG_FILE_NAME = 'multi-document-console.yml';
const MULTI_DOCUMENT_CONFIG_CONTENT = [
  'consoleProjects:',
  "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
  '---',
  'consoleGithubTokens:',
  '  pj-b: token-a',
  '',
].join('\n');
const EXCESSIVE_ALIAS_CONFIG_FILE_NAME = 'excessive-alias-console.yml';
const EXCESSIVE_ALIAS_REFERENCE_COUNT = 101;
const EXCESSIVE_ALIAS_CONFIG_CONTENT = [
  'consoleGithubTokens:',
  '  pj-b: &pj-b-token token-a',
  'references:',
  ...Array.from(
    { length: EXCESSIVE_ALIAS_REFERENCE_COUNT },
    () => '  - *pj-b-token',
  ),
  '',
].join('\n');

const UNRESOLVED_TAG_CONFIG_FILE_NAME = 'unresolved-tag-console.yml';
const UNRESOLVED_TAG_CONFIG_CONTENT =
  'consoleProjects:\n  umino: https://github.com/orgs/org-a/projects/1\nconsoleGithubTokens:\n  umino: !foo FAKE_SECRET_VALUE_123\n';
const FAKE_SECRET_VALUE = 'FAKE_SECRET_VALUE_123';
const YAML_WARNING_NAME = 'YAMLWarning';
const SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_FILE_NAME =
  'syntax-error-token-line-console.yml';
const SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_CONTENT = [
  'consoleGithubTokens: {',
  '  umino: FAKE_SECRET_VALUE_123 x',
  '',
].join('\n');
const UNRESOLVED_ALIAS_CONFIG_FILE_NAME = 'unresolved-alias-console.yml';
const UNRESOLVED_ALIAS_CONFIG_CONTENT =
  'consoleGithubTokens:\n  umino: *FAKE_SECRET_VALUE_123\n';
const INVALID_ISSUE_URL = 'not-a-url';

type StoryGateCommandName =
  'checkStoryGate' | 'setIssueStoryIfUnset' | 'startSpecificationTask';

type ConfigFileInput = 'missing file' | 'malformed content';

type CliRun = {
  stdoutText: string;
  stderrText: string;
  exitCodes: number[];
};

type RecordedRequest = {
  url: string;
  authorization: string | null;
};

type ConfigFileErrorObservation = {
  commandName: StoryGateCommandName;
  configFileInput: ConfigFileInput;
  firstExitCode: number | undefined;
  stderrHasLoadFailureMessage: boolean;
  defaultTokenInOutput: boolean;
  requestUrls: string[];
  defaultTokenRequestCount: number;
};

type MalformedConfigFileObservation = ConfigFileErrorObservation & {
  configTokenInOutput: boolean;
};

type UnresolvedTagObservation = {
  commandName: StoryGateCommandName;
  firstExitCode: number | undefined;
  stdoutLeaks: boolean;
  stderrLeaks: boolean;
  emittedWarningLeakCount: number;
  requestUrls: string[];
};

type CommandConfigFileRun = {
  commandName: StoryGateCommandName;
  run: CliRun;
  requests: RecordedRequest[];
};

const CONFIG_FILE_ERROR_CASES: {
  commandName: StoryGateCommandName;
  configFileInput: ConfigFileInput;
}[] = [
  { commandName: 'checkStoryGate', configFileInput: 'missing file' },
  { commandName: 'checkStoryGate', configFileInput: 'malformed content' },
  { commandName: 'setIssueStoryIfUnset', configFileInput: 'missing file' },
  { commandName: 'setIssueStoryIfUnset', configFileInput: 'malformed content' },
  { commandName: 'startSpecificationTask', configFileInput: 'missing file' },
  {
    commandName: 'startSpecificationTask',
    configFileInput: 'malformed content',
  },
];

const GH_TOKEN_UNSET_CONFIG_FILE_ERROR_CASES: {
  commandName: StoryGateCommandName;
}[] = [
  { commandName: 'checkStoryGate' },
  { commandName: 'setIssueStoryIfUnset' },
  { commandName: 'startSpecificationTask' },
];

const UNRESOLVED_TAG_INVALID_ISSUE_URL_CASES: {
  commandName: StoryGateCommandName;
  expectedExitCode: number;
}[] = [
  { commandName: 'checkStoryGate', expectedExitCode: 2 },
  { commandName: 'setIssueStoryIfUnset', expectedExitCode: 2 },
  { commandName: 'startSpecificationTask', expectedExitCode: 2 },
];

const STORY_GATE_COMMAND_NAMES: StoryGateCommandName[] = [
  'checkStoryGate',
  'setIssueStoryIfUnset',
  'startSpecificationTask',
];

class ProcessExitSentinel extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super(`process.exit(${exitCode}) called`);
    this.exitCode = exitCode;
  }
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const requestUrlOf = (input: string | URL | Request): string =>
  typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

const loadFailureMessageOf = (configFilePath: string): string => {
  try {
    fs.readFileSync(configFilePath, 'utf-8');
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    return `Failed to load configuration file "${configFilePath}": ${cause}`;
  }
  throw new Error(`${configFilePath} reads without an error`);
};

const malformedYamlMessageOf = (configFilePath: string): string => {
  try {
    YAML.parse(fs.readFileSync(configFilePath, 'utf-8'));
  } catch (error) {
    if (!(error instanceof YAML.YAMLParseError)) {
      throw error;
    }
    const firstLinePos = error.linePos?.[0];
    const location =
      firstLinePos === undefined
        ? 'malformed YAML'
        : `malformed YAML at line ${firstLinePos.line}, column ${firstLinePos.col}`;
    return `Failed to load configuration file "${configFilePath}": ${location}`;
  }
  throw new Error(`${configFilePath} loads without an error`);
};

const commandArgumentsOf = (
  commandName: StoryGateCommandName,
  configDirectory: string,
  outputDirectory: string,
  issueUrl: string = ISSUE_A_URL,
): string[] => {
  const argumentsByCommand: Record<StoryGateCommandName, string[]> = {
    checkStoryGate: [
      'checkStoryGate',
      '--issueUrl',
      issueUrl,
      '--agentName',
      'developer-agent',
      '--triageAgentName',
      'triage-agent',
      '--specificationAgentName',
      'spec-agent',
      '--configDirectory',
      configDirectory,
      '--outputDirectory',
      outputDirectory,
    ],
    setIssueStoryIfUnset: [
      'setIssueStoryIfUnset',
      '--issueUrl',
      issueUrl,
      '--story',
      'feature A',
    ],
    startSpecificationTask: [
      'startSpecificationTask',
      '--issueUrl',
      issueUrl,
      '--specificationAgentName',
      'spec-agent',
    ],
  };
  return argumentsByCommand[commandName];
};

const runCliArguments = async (
  commandLineArguments: string[],
  options: { settleMacrotask: boolean } = { settleMacrotask: false },
): Promise<CliRun> => {
  const consoleLogSpy = jest
    .spyOn(console, 'log')
    .mockImplementation(() => undefined);
  const consoleErrorSpy = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  const stdoutWriteSpy = jest
    .spyOn(process.stdout, 'write')
    .mockImplementation(() => true);
  const stderrWriteSpy = jest
    .spyOn(process.stderr, 'write')
    .mockImplementation(() => true);
  const processExitSpy = jest
    .spyOn(process, 'exit')
    .mockImplementation((exitCode) => {
      throw new ProcessExitSentinel(Number(exitCode ?? 0));
    });

  try {
    try {
      await program.parseAsync(['node', 'test', ...commandLineArguments]);
    } catch (error) {
      if (!(error instanceof ProcessExitSentinel)) {
        throw error;
      }
    }

    if (options.settleMacrotask) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    return {
      stdoutText: [
        ...consoleLogSpy.mock.calls.map(
          (printedValues) => `${printedValues.map(String).join(' ')}\n`,
        ),
        ...stdoutWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ].join(''),
      stderrText: [
        ...consoleErrorSpy.mock.calls.map(
          (printedValues) => `${printedValues.map(String).join(' ')}\n`,
        ),
        ...stderrWriteSpy.mock.calls.map(([chunk]) => String(chunk)),
      ].join(''),
      exitCodes: processExitSpy.mock.calls.map(([exitCode]) =>
        Number(exitCode ?? 0),
      ),
    };
  } finally {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    stdoutWriteSpy.mockRestore();
    stderrWriteSpy.mockRestore();
    processExitSpy.mockRestore();
  }
};

const fakeGithubFetch = (): RecordedRequest[] => {
  const requests: RecordedRequest[] = [];
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input, init): Promise<Response> => {
      requests.push({
        url: requestUrlOf(input),
        authorization: new Headers(init?.headers).get('authorization'),
      });
      return jsonResponse({ message: 'Not Found' }, 404);
    });
  return requests;
};

const envWithoutGhTokenOf = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv => {
  const envWithoutGhToken = { ...env };
  delete envWithoutGhToken.GH_TOKEN;
  return envWithoutGhToken;
};

const runCliArgumentsWithoutGhToken = async (
  commandLineArguments: string[],
): Promise<CliRun> => {
  const envWithDefaultToken = process.env;
  process.env = envWithoutGhTokenOf(envWithDefaultToken);
  try {
    return await runCliArguments(commandLineArguments);
  } finally {
    process.env = envWithDefaultToken;
  }
};

const outputOf = (run: CliRun): string =>
  `${run.stdoutText}\n${run.stderrText}`;

const containsUnresolvedTagLeak = (text: string): boolean =>
  text.includes(FAKE_SECRET_VALUE) || text.includes(YAML_WARNING_NAME);

describe('story-gate commands with an unreadable --configFilePath', () => {
  let workDirectory: string;
  let configDirectory: string;
  let outputDirectory: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    workDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'story-gate-config-file-errors-'),
    );
    configDirectory = path.join(workDirectory, 'config');
    outputDirectory = path.join(workDirectory, 'output');
    fs.mkdirSync(path.join(workDirectory, 'cache'));
    fs.mkdirSync(configDirectory);
    fs.writeFileSync(
      path.join(configDirectory, 'example.config.yaml'),
      'org: org-a\nagents:\n  - developer-agent\n  - triage-agent\n',
    );
    originalEnv = process.env;
    process.env = {
      ...originalEnv,
      GH_TOKEN: DEFAULT_TOKEN,
      XDG_CACHE_HOME: path.join(workDirectory, 'cache'),
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    fs.rmSync(workDirectory, { recursive: true, force: true });
  });

  const configFilePathOf = (configFileInput: ConfigFileInput): string => {
    if (configFileInput === 'missing file') {
      return path.join(workDirectory, MISSING_CONFIG_FILE_NAME);
    }
    const malformedConfigFilePath = path.join(
      workDirectory,
      MALFORMED_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(malformedConfigFilePath, MALFORMED_CONFIG_CONTENT);
    return malformedConfigFilePath;
  };

  it('exits 1 with the loadConfigFile message in stderr, no token value and no GitHub request when --configFilePath is missing', async () => {
    const missingFileCases = CONFIG_FILE_ERROR_CASES.filter(
      ({ configFileInput }) => configFileInput === 'missing file',
    );
    const observations: ConfigFileErrorObservation[] = [];

    for (const { commandName, configFileInput } of missingFileCases) {
      const requests = fakeGithubFetch();
      const configFilePath = configFilePathOf(configFileInput);
      const expectedLoadFailureMessage = loadFailureMessageOf(configFilePath);
      const run = await runCliArguments([
        ...commandArgumentsOf(commandName, configDirectory, outputDirectory),
        '--configFilePath',
        configFilePath,
      ]);

      observations.push({
        commandName,
        configFileInput,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        defaultTokenInOutput: `${run.stdoutText}\n${run.stderrText}`.includes(
          DEFAULT_TOKEN,
        ),
        requestUrls: requests.map((request) => request.url),
        defaultTokenRequestCount: requests.filter((request) =>
          (request.authorization ?? '').includes(DEFAULT_TOKEN),
        ).length,
      });
      jest.restoreAllMocks();
    }

    expect(observations).toEqual(
      missingFileCases.map(({ commandName, configFileInput }) => ({
        commandName,
        configFileInput,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        defaultTokenInOutput: false,
        requestUrls: [],
        defaultTokenRequestCount: 0,
      })),
    );
  });

  it('exits 1 with the malformed-YAML message in stderr, no token value and no GitHub request when --configFilePath content is malformed', async () => {
    const malformedCases = CONFIG_FILE_ERROR_CASES.filter(
      ({ configFileInput }) => configFileInput === 'malformed content',
    );
    const observations: MalformedConfigFileObservation[] = [];

    for (const { commandName, configFileInput } of malformedCases) {
      const requests = fakeGithubFetch();
      const configFilePath = configFilePathOf(configFileInput);
      const expectedLoadFailureMessage = malformedYamlMessageOf(configFilePath);
      const run = await runCliArguments([
        ...commandArgumentsOf(commandName, configDirectory, outputDirectory),
        '--configFilePath',
        configFilePath,
      ]);

      observations.push({
        commandName,
        configFileInput,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        defaultTokenInOutput: `${run.stdoutText}\n${run.stderrText}`.includes(
          DEFAULT_TOKEN,
        ),
        configTokenInOutput: `${run.stdoutText}\n${run.stderrText}`.includes(
          CONFIG_FILE_TOKEN_VALUE,
        ),
        requestUrls: requests.map((request) => request.url),
        defaultTokenRequestCount: requests.filter((request) =>
          (request.authorization ?? '').includes(DEFAULT_TOKEN),
        ).length,
      });
      jest.restoreAllMocks();
    }

    expect(observations).toEqual(
      malformedCases.map(({ commandName, configFileInput }) => ({
        commandName,
        configFileInput,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        defaultTokenInOutput: false,
        configTokenInOutput: false,
        requestUrls: [],
        defaultTokenRequestCount: 0,
      })),
    );
  });

  it('exits 1 with the loadConfigFile message in stderr, no token value and no GitHub request when GH_TOKEN is unset and --configFilePath is missing', async () => {
    const observations: ConfigFileErrorObservation[] = [];

    for (const { commandName } of GH_TOKEN_UNSET_CONFIG_FILE_ERROR_CASES) {
      const requests = fakeGithubFetch();
      const configFilePath = configFilePathOf('missing file');
      const expectedLoadFailureMessage = loadFailureMessageOf(configFilePath);
      const run = await runCliArgumentsWithoutGhToken([
        ...commandArgumentsOf(commandName, configDirectory, outputDirectory),
        '--configFilePath',
        configFilePath,
      ]);

      observations.push({
        commandName,
        configFileInput: 'missing file',
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        defaultTokenInOutput: `${run.stdoutText}\n${run.stderrText}`.includes(
          DEFAULT_TOKEN,
        ),
        requestUrls: requests.map((request) => request.url),
        defaultTokenRequestCount: requests.filter((request) =>
          (request.authorization ?? '').includes(DEFAULT_TOKEN),
        ).length,
      });
      jest.restoreAllMocks();
    }

    expect(observations).toEqual(
      GH_TOKEN_UNSET_CONFIG_FILE_ERROR_CASES.map(({ commandName }) => ({
        commandName,
        configFileInput: 'missing file',
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        defaultTokenInOutput: false,
        requestUrls: [],
        defaultTokenRequestCount: 0,
      })),
    );
  });

  const runCommandsWithConfigFile = async (
    configFilePath: string,
  ): Promise<CommandConfigFileRun[]> => {
    const runs: CommandConfigFileRun[] = [];
    for (const commandName of STORY_GATE_COMMAND_NAMES) {
      const requests = fakeGithubFetch();
      const run = await runCliArguments([
        ...commandArgumentsOf(commandName, configDirectory, outputDirectory),
        '--configFilePath',
        configFilePath,
      ]);
      runs.push({ commandName, run, requests });
      jest.restoreAllMocks();
    }
    return runs;
  };

  it('exits 1 with the malformed-YAML location, no YAML tag text and no token value in output when --configFilePath has a tag warning and a syntax error', async () => {
    const configFilePath = path.join(
      workDirectory,
      TAGGED_MALFORMED_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, TAGGED_MALFORMED_CONFIG_CONTENT);
    const expectedLoadFailureMessage = `Failed to load configuration file "${configFilePath}": malformed YAML at line 3, column 3`;
    const runs = await runCommandsWithConfigFile(configFilePath);

    const observations = runs.map(({ commandName, run, requests }) => {
      const output = outputOf(run);
      return {
        commandName,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        yamlTagTextInOutput: output.includes(YAML_TAG_TEXT),
        configTokenInOutput: output.includes(CONFIG_FILE_TOKEN_VALUE),
        defaultTokenInOutput: output.includes(DEFAULT_TOKEN),
        requestUrls: requests.map((request) => request.url),
      };
    });

    expect(observations).toEqual(
      STORY_GATE_COMMAND_NAMES.map((commandName) => ({
        commandName,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        yamlTagTextInOutput: false,
        configTokenInOutput: false,
        defaultTokenInOutput: false,
        requestUrls: [],
      })),
    );
  });

  it('exits 1 with the malformed-YAML location and no token value in output when --configFilePath holds two YAML documents', async () => {
    const configFilePath = path.join(
      workDirectory,
      MULTI_DOCUMENT_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, MULTI_DOCUMENT_CONFIG_CONTENT);
    const expectedLoadFailureMessage = `Failed to load configuration file "${configFilePath}": malformed YAML at line 3, column 1`;
    const runs = await runCommandsWithConfigFile(configFilePath);

    const observations = runs.map(({ commandName, run, requests }) => {
      const output = outputOf(run);
      return {
        commandName,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        configTokenInOutput: output.includes(CONFIG_FILE_TOKEN_VALUE),
        defaultTokenInOutput: output.includes(DEFAULT_TOKEN),
        requestUrls: requests.map((request) => request.url),
      };
    });

    expect(observations).toEqual(
      STORY_GATE_COMMAND_NAMES.map((commandName) => ({
        commandName,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        configTokenInOutput: false,
        defaultTokenInOutput: false,
        requestUrls: [],
      })),
    );
  });

  it('exits 2 with no YAML warning and no token value in stdout or stderr when --configFilePath has an unresolved YAML tag and --issueUrl is invalid', async () => {
    const configFilePath = path.join(
      workDirectory,
      UNRESOLVED_TAG_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, UNRESOLVED_TAG_CONFIG_CONTENT);
    const observations: UnresolvedTagObservation[] = [];

    for (const { commandName } of UNRESOLVED_TAG_INVALID_ISSUE_URL_CASES) {
      const requests = fakeGithubFetch();
      const emitWarningSpy = jest
        .spyOn(process, 'emitWarning')
        .mockImplementation(() => undefined);
      const run = await runCliArguments(
        [
          ...commandArgumentsOf(
            commandName,
            configDirectory,
            outputDirectory,
            INVALID_ISSUE_URL,
          ),
          '--configFilePath',
          configFilePath,
        ],
        { settleMacrotask: true },
      );

      observations.push({
        commandName,
        firstExitCode: run.exitCodes[0],
        stdoutLeaks: containsUnresolvedTagLeak(run.stdoutText),
        stderrLeaks: containsUnresolvedTagLeak(run.stderrText),
        emittedWarningLeakCount: emitWarningSpy.mock.calls.filter(([warning]) =>
          containsUnresolvedTagLeak(String(warning)),
        ).length,
        requestUrls: requests.map((request) => request.url),
      });
      jest.restoreAllMocks();
    }

    expect(observations).toEqual(
      UNRESOLVED_TAG_INVALID_ISSUE_URL_CASES.map(
        ({ commandName, expectedExitCode }) => ({
          commandName,
          firstExitCode: expectedExitCode,
          stdoutLeaks: false,
          stderrLeaks: false,
          emittedWarningLeakCount: 0,
          requestUrls: [],
        }),
      ),
    );
  });

  it('exits 1 with the malformed-YAML location and no source line in output when --configFilePath has a syntax error on a token line', async () => {
    const configFilePath = path.join(
      workDirectory,
      SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, SYNTAX_ERROR_ON_TOKEN_LINE_CONFIG_CONTENT);
    const expectedLoadFailureMessage = `Failed to load configuration file "${configFilePath}": malformed YAML at line 3, column 1`;
    const runs = await runCommandsWithConfigFile(configFilePath);

    const observations = runs.map(({ commandName, run, requests }) => {
      const output = outputOf(run);
      return {
        commandName,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        tokenValueInOutput: output.includes(FAKE_SECRET_VALUE),
        requestUrls: requests.map((request) => request.url),
      };
    });

    expect(observations).toEqual(
      STORY_GATE_COMMAND_NAMES.map((commandName) => ({
        commandName,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        tokenValueInOutput: false,
        requestUrls: [],
      })),
    );
  });

  it('exits 1 with the parser error message and no token value in output when --configFilePath exceeds the YAML alias limit', async () => {
    const configFilePath = path.join(
      workDirectory,
      EXCESSIVE_ALIAS_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, EXCESSIVE_ALIAS_CONFIG_CONTENT);
    const expectedLoadFailureMessage = `Failed to load configuration file "${configFilePath}": Excessive alias count indicates a resource exhaustion attack`;
    const runs = await runCommandsWithConfigFile(configFilePath);

    const observations = runs.map(({ commandName, run, requests }) => {
      const output = outputOf(run);
      return {
        commandName,
        firstExitCode: run.exitCodes[0],
        stderrHasLoadFailureMessage: run.stderrText.startsWith(
          expectedLoadFailureMessage,
        ),
        configTokenInOutput: output.includes(CONFIG_FILE_TOKEN_VALUE),
        defaultTokenInOutput: output.includes(DEFAULT_TOKEN),
        requestUrls: requests.map((request) => request.url),
      };
    });

    expect(observations).toEqual(
      STORY_GATE_COMMAND_NAMES.map((commandName) => ({
        commandName,
        firstExitCode: 1,
        stderrHasLoadFailureMessage: true,
        configTokenInOutput: false,
        defaultTokenInOutput: false,
        requestUrls: [],
      })),
    );
  });

  it('exits 1 with the Unresolved alias message and no alias name in stdout or stderr for each story-gate command when --configFilePath holds an undefined alias', async () => {
    const configFilePath = path.join(
      workDirectory,
      UNRESOLVED_ALIAS_CONFIG_FILE_NAME,
    );
    fs.writeFileSync(configFilePath, UNRESOLVED_ALIAS_CONFIG_CONTENT);
    const expectedLoadFailureMessagePrefix = `Failed to load configuration file "${configFilePath}": `;
    const runs = await runCommandsWithConfigFile(configFilePath);

    const observations = runs.map(({ commandName, run, requests }) => {
      const output = outputOf(run);
      return {
        commandName,
        firstExitCode: run.exitCodes[0],
        stderrStartsWithLoadFailurePrefix: run.stderrText.startsWith(
          expectedLoadFailureMessagePrefix,
        ),
        stderrNamesUnresolvedAlias: run.stderrText.includes('Unresolved alias'),
        aliasNameInOutput: output.includes(FAKE_SECRET_VALUE),
        requestUrls: requests.map((request) => request.url),
      };
    });

    expect(observations).toEqual(
      STORY_GATE_COMMAND_NAMES.map((commandName) => ({
        commandName,
        firstExitCode: 1,
        stderrStartsWithLoadFailurePrefix: true,
        stderrNamesUnresolvedAlias: true,
        aliasNameInOutput: false,
        requestUrls: [],
      })),
    );
  });
});
