import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { program } from './index';

const DEFAULT_TOKEN = 'test-token';
const ISSUE_A_URL = 'https://github.com/org-a/repo-a/issues/1';
const MISSING_CONFIG_FILE_NAME = 'absent-console.yml';
const MALFORMED_CONFIG_FILE_NAME = 'malformed-console.yml';
const MALFORMED_CONFIG_CONTENT = [
  'consoleProjects: {',
  "  pj-a: 'https://github.com/orgs/org-a/projects/1'",
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

type ConfigFileErrorObservation = {
  commandName: StoryGateCommandName;
  configFileInput: ConfigFileInput;
  exitCodes: number[];
  stderrNamesConfigFilePath: boolean;
  defaultTokenInOutput: boolean;
  requestUrls: string[];
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
    .mockImplementation(jest.fn<never, Parameters<typeof process.exit>>());

  try {
    await program.parseAsync(['node', 'test', ...commandLineArguments]);

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

const fakeGithubFetch = (): string[] => {
  const requestUrls: string[] = [];
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async (input): Promise<Response> => {
      requestUrls.push(requestUrlOf(input));
      return jsonResponse({ message: 'Not Found' }, 404);
    });
  return requestUrls;
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

  it('exits 2 with the config file path in stderr, no token value and no GitHub request when --configFilePath is missing or unparsable', async () => {
    const observations: ConfigFileErrorObservation[] = [];

    for (const { commandName, configFileInput } of CONFIG_FILE_ERROR_CASES) {
      const requestUrls = fakeGithubFetch();
      const configFilePath = configFilePathOf(configFileInput);
      const run = await runCliArguments([
        ...commandArgumentsOf(commandName, configDirectory, outputDirectory),
        '--configFilePath',
        configFilePath,
      ]);

      observations.push({
        commandName,
        configFileInput,
        exitCodes: run.exitCodes,
        stderrNamesConfigFilePath: run.stderrText.includes(configFilePath),
        defaultTokenInOutput: `${run.stdoutText}\n${run.stderrText}`.includes(
          DEFAULT_TOKEN,
        ),
        requestUrls,
      });
      jest.restoreAllMocks();
    }

    expect(observations).toEqual(
      CONFIG_FILE_ERROR_CASES.map(({ commandName, configFileInput }) => ({
        commandName,
        configFileInput,
        exitCodes: [2],
        stderrNamesConfigFilePath: true,
        defaultTokenInOutput: false,
        requestUrls: [],
      })),
    );
  });
});
