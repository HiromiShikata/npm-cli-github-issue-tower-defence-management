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
): string[] => {
  const argumentsByCommand: Record<StoryGateCommandName, string[]> = {
    checkStoryGate: [
      'checkStoryGate',
      '--issueUrl',
      ISSUE_A_URL,
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
      ISSUE_A_URL,
      '--story',
      'feature A',
    ],
    startSpecificationTask: [
      'startSpecificationTask',
      '--issueUrl',
      ISSUE_A_URL,
      '--specificationAgentName',
      'spec-agent',
    ],
  };
  return argumentsByCommand[commandName];
};

const runCliArguments = async (
  commandLineArguments: string[],
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
        stderrHasLoadFailureMessage: run.stderrText.includes(
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
        stderrHasLoadFailureMessage: run.stderrText.includes(
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
        stderrHasLoadFailureMessage: run.stderrText.includes(
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
});
