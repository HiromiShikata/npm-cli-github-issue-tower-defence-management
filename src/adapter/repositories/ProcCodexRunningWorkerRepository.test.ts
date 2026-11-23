import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcCodexRunningWorkerRepository } from './ProcCodexRunningWorkerRepository';

const ISSUE_URL_1 = 'https://github.com/HiromiShikata/example/issues/1';
const ISSUE_URL_2 = 'https://github.com/HiromiShikata/example/issues/2';
const AW_PATH = '"$HOME/git/secretary/machine/sk/aw"';

const argv = (...parts: string[]): string => `${parts.join('\0')}\0`;

const localCodexWorker = (issueUrl: string, model = 'gpt-5-codex'): string =>
  argv(
    'bash',
    '-c',
    `: "Take ownership of ${issueUrl}"; ${AW_PATH} ${issueUrl} codex-agent ${model}`,
  );

const sshDelegatedCodexWorker = (issueUrl: string): string =>
  argv(
    'ssh',
    'remote-host',
    `bash -ic 'set +m; : "Take ownership of ${issueUrl}"; ${AW_PATH} ${issueUrl} codex-agent gpt-5-codex --configFilePath /home/u/.config/aw.json'`,
  );

const claudeWorker = (issueUrl: string): string =>
  argv(
    'bash',
    '-c',
    `: "Take ownership of ${issueUrl}"; ${AW_PATH} ${issueUrl} claude-agent claude-opus-4-1`,
  );

const claudeProcessWithoutAwInvocation = (issueUrl: string): string =>
  argv('claude', '--verbose', '-p', `Take ownership of ${issueUrl}`);

const codexExecSubagentOfClaudeWorker = (issueUrl: string): string =>
  argv(
    'codex',
    'exec',
    '--model',
    'gpt-5-codex',
    `Take ownership of ${issueUrl}`,
  );

describe('ProcCodexRunningWorkerRepository', () => {
  let procDirectory: string;

  beforeEach(() => {
    procDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fake-proc-codex-worker-'),
    );
  });

  afterEach(() => {
    fs.rmSync(procDirectory, { recursive: true, force: true });
  });

  let nextPid = 1000;

  const writeProcess = (cmdline: string): number => {
    nextPid += 1;
    const processDirectory = path.join(procDirectory, String(nextPid));
    fs.mkdirSync(processDirectory, { recursive: true });
    fs.writeFileSync(path.join(processDirectory, 'cmdline'), cmdline);
    return nextPid;
  };

  const listUrls = (): { issueUrls: string[]; errorMessages: string[] } => {
    const result = new ProcCodexRunningWorkerRepository(
      procDirectory,
    ).listRunningCodexWorkerIssueUrls();
    return { ...result, issueUrls: [...result.issueUrls].sort() };
  };

  const cases: {
    name: string;
    cmdlines: string[];
    expectedIssueUrls: string[];
  }[] = [
    {
      name: 'counts a local codex aw worker',
      cmdlines: [localCodexWorker(ISSUE_URL_1)],
      expectedIssueUrls: [ISSUE_URL_1],
    },
    {
      name: 'counts an ssh-delegated remote codex worker',
      cmdlines: [sshDelegatedCodexWorker(ISSUE_URL_1)],
      expectedIssueUrls: [ISSUE_URL_1],
    },
    {
      name: 'counts an aw invocation whose path is not quoted',
      cmdlines: [
        argv(
          'bash',
          '-c',
          `: "Take ownership of ${ISSUE_URL_1}"; /usr/local/bin/aw ${ISSUE_URL_1} codex-agent gpt-5-codex`,
        ),
      ],
      expectedIssueUrls: [ISSUE_URL_1],
    },
    {
      name: 'strips surrounding quotes from the model token',
      cmdlines: [
        argv(
          'bash',
          '-c',
          `: "Take ownership of ${ISSUE_URL_1}"; ${AW_PATH} ${ISSUE_URL_1} codex-agent "gpt-5-codex"`,
        ),
      ],
      expectedIssueUrls: [ISSUE_URL_1],
    },
    {
      name: 'does not count a claude aw worker',
      cmdlines: [claudeWorker(ISSUE_URL_1)],
      expectedIssueUrls: [],
    },
    {
      name: 'does not count a claude process that carries the take ownership text without an aw invocation',
      cmdlines: [claudeProcessWithoutAwInvocation(ISSUE_URL_1)],
      expectedIssueUrls: [],
    },
    {
      name: 'does not count a codex exec subagent started by a claude worker',
      cmdlines: [
        claudeWorker(ISSUE_URL_1),
        codexExecSubagentOfClaudeWorker(ISSUE_URL_1),
      ],
      expectedIssueUrls: [],
    },
    {
      name: 'counts duplicate processes for one issue URL once',
      cmdlines: [
        localCodexWorker(ISSUE_URL_1),
        sshDelegatedCodexWorker(ISSUE_URL_1),
        localCodexWorker(ISSUE_URL_1),
      ],
      expectedIssueUrls: [ISSUE_URL_1],
    },
    {
      name: 'counts every distinct issue URL of several codex workers',
      cmdlines: [
        localCodexWorker(ISSUE_URL_1),
        sshDelegatedCodexWorker(ISSUE_URL_2),
      ],
      expectedIssueUrls: [ISSUE_URL_1, ISSUE_URL_2],
    },
    {
      name: 'does not count an aw invocation whose issue URL differs from the take ownership URL',
      cmdlines: [
        argv(
          'bash',
          '-c',
          `: "Take ownership of ${ISSUE_URL_1}"; ${AW_PATH} ${ISSUE_URL_2} codex-agent gpt-5-codex`,
        ),
      ],
      expectedIssueUrls: [],
    },
    {
      name: 'does not count an aw invocation without a model token',
      cmdlines: [
        argv(
          'bash',
          '-c',
          `: "Take ownership of ${ISSUE_URL_1}"; ${AW_PATH} ${ISSUE_URL_1} codex-agent`,
        ),
      ],
      expectedIssueUrls: [],
    },
  ];

  it.each(cases)('$name', ({ cmdlines, expectedIssueUrls }) => {
    for (const cmdline of cmdlines) {
      writeProcess(cmdline);
    }
    expect(listUrls()).toEqual({
      issueUrls: expectedIssueUrls,
      errorMessages: [],
    });
  });

  it('records an error message and returns no URLs when the proc directory cannot be read', () => {
    const missingProcDirectory = path.join(procDirectory, 'missing');
    const result = new ProcCodexRunningWorkerRepository(
      missingProcDirectory,
    ).listRunningCodexWorkerIssueUrls();
    expect(result.issueUrls).toEqual([]);
    expect(result.errorMessages.length).toBeGreaterThan(0);
  });

  it('records an error for a process whose cmdline read fails with a non-ENOENT error and still returns the other URLs', () => {
    writeProcess(localCodexWorker(ISSUE_URL_2));
    const unreadablePid = writeProcess(localCodexWorker(ISSUE_URL_1));
    const unreadableCmdlinePath = path.join(
      procDirectory,
      String(unreadablePid),
      'cmdline',
    );
    fs.rmSync(unreadableCmdlinePath);
    fs.mkdirSync(unreadableCmdlinePath);

    const result = listUrls();

    expect(result.issueUrls).toEqual([ISSUE_URL_2]);
    expect(result.errorMessages.length).toBeGreaterThan(0);
  });

  it('skips a process that vanished between listing and reading without recording an error', () => {
    writeProcess(localCodexWorker(ISSUE_URL_1));
    nextPid += 1;
    fs.mkdirSync(path.join(procDirectory, String(nextPid)));

    expect(listUrls()).toEqual({
      issueUrls: [ISSUE_URL_1],
      errorMessages: [],
    });
  });
});
