import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { NodeTmuxSessionRepository } from './NodeTmuxSessionRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

type BatchingTmuxSessionRepository = {
  listSessionNamesForIssueUrls: (
    issueUrls: string[],
  ) => Promise<Map<string, string[]>>;
};

type FailedCommand = 'ps' | 'list-panes';

type CommandFailure = {
  failedCommand: FailedCommand;
  stderr: string;
};

type CommandOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
  spawnInteractive: jest.fn(),
});

const repositoryBatchesIssueSessions = (
  repository: object,
): repository is BatchingTmuxSessionRepository =>
  'listSessionNamesForIssueUrls' in repository;

const asBatchingRepository = (
  repository: object,
): BatchingTmuxSessionRepository => {
  if (!repositoryBatchesIssueSessions(repository))
    throw new Error('Missing batch issue session mapping method');
  return repository;
};

const ISSUE_COUNT = 300;

const issueUrlFor = (issueNumber: number): string =>
  `https://github.com/demo/repo/issues/${issueNumber}`;

const openIssueUrls = Array.from({ length: ISSUE_COUNT }, (_, index) =>
  issueUrlFor(index + 1),
);

const matchedSessionNamesByIssueNumber = [
  { issueNumber: 7, sessionNames: ['renamed-alpha'] },
  { issueNumber: 150, sessionNames: ['renamed-beta'] },
  { issueNumber: 299, sessionNames: ['renamed-gamma', 'renamed-delta'] },
];

const processTableStdout = [
  '1 0 systemd',
  '1007 1 bash',
  `1008 1007 claude --name ${issueUrlFor(7)}`,
  '2150 1 bash',
  '2151 2150 bash',
  `2152 2151 codex ${issueUrlFor(150)}`,
  '2990 1 bash',
  `2991 2990 claude --name ${issueUrlFor(299)}`,
  '3000 1 bash',
  `3001 3000 codex ${issueUrlFor(299)}`,
  `5000 1 claude --name ${issueUrlFor(42)}`,
  '6000 1 bash',
  '',
].join('\n');

const listPanesStdout = [
  '1007 renamed-alpha',
  '2150 renamed-beta',
  '2990 renamed-gamma',
  '3000 renamed-delta',
  '4000 unmapped',
  '',
].join('\n');

const listSessionsStdout = [
  'renamed-alpha',
  'renamed-beta',
  'renamed-gamma',
  'renamed-delta',
  'unmapped',
  '',
].join('\n');

const expectedSessionNamesForUrl = (url: string): string[] =>
  matchedSessionNamesByIssueNumber.find(
    (row) => issueUrlFor(row.issueNumber) === url,
  )?.sessionNames ?? [];

const expectedBatchResultFor = (issueUrls: string[]): Map<string, string[]> =>
  new Map<string, string[]>(
    issueUrls.map((url): [string, string[]] => [
      url,
      expectedSessionNamesForUrl(url),
    ]),
  );

const commandResult = (
  stdout: string,
  failureStderr: string | null,
): CommandOutput =>
  failureStderr === null
    ? { stdout, stderr: '', exitCode: 0 }
    : { stdout: '', stderr: failureStderr, exitCode: 1 };

const createFixtureRunner = (
  failure: CommandFailure | null,
): Mocked<LocalCommandRunner> => {
  const runner = createMockRunner();
  runner.runCommand.mockImplementation(
    async (program: string, args: string[]) => {
      if (program === 'ps')
        return commandResult(
          processTableStdout,
          failure?.failedCommand === 'ps' ? failure.stderr : null,
        );
      if (program === 'tmux' && args[0] === 'list-panes')
        return commandResult(
          listPanesStdout,
          failure?.failedCommand === 'list-panes' ? failure.stderr : null,
        );
      if (program === 'tmux' && args[0] === 'list-sessions')
        return commandResult(listSessionsStdout, null);
      throw new Error(`Unexpected command: ${program} ${args.join(' ')}`);
    },
  );
  return runner;
};

describe('NodeTmuxSessionRepository batch issue session lookup', () => {
  it('maps each of the 300 open issue URLs to the sessions of its descendant panes', async () => {
    const runner = createFixtureRunner(null);
    const repository = new NodeTmuxSessionRepository(runner);

    const result =
      await asBatchingRepository(repository).listSessionNamesForIssueUrls(
        openIssueUrls,
      );

    expect(result).toEqual(expectedBatchResultFor(openIssueUrls));
  });

  it.each([{ urlCount: 1 }, { urlCount: 2 }, { urlCount: ISSUE_COUNT }])(
    'runs one ps and one tmux list-panes for $urlCount issue URLs',
    async ({ urlCount }) => {
      const runner = createFixtureRunner(null);
      const repository = new NodeTmuxSessionRepository(runner);

      await asBatchingRepository(repository).listSessionNamesForIssueUrls(
        openIssueUrls.slice(0, urlCount),
      );

      const psCalls = runner.runCommand.mock.calls
        .filter(([program]) => program === 'ps')
        .map(([program, args]) => [program, args]);
      const listPanesCalls = runner.runCommand.mock.calls
        .filter(
          ([program, args]) => program === 'tmux' && args[0] === 'list-panes',
        )
        .map(([program, args]) => [program, args]);
      expect(psCalls).toEqual([['ps', ['-eo', 'pid=,ppid=,args=']]]);
      expect(listPanesCalls).toEqual([
        ['tmux', ['list-panes', '-a', '-F', '#{pane_pid} #{session_name}']],
      ]);
    },
  );

  it('returns an empty Map and runs no command for an empty input', async () => {
    const runner = createFixtureRunner(null);
    const repository = new NodeTmuxSessionRepository(runner);

    await expect(
      asBatchingRepository(repository).listSessionNamesForIssueUrls([]),
    ).resolves.toEqual(new Map<string, string[]>());
    expect(runner.runCommand.mock.calls).toEqual([]);
  });

  it.each(matchedSessionNamesByIssueNumber)(
    'keeps the per-URL lookup returning the same sessions for issue $issueNumber',
    async ({ issueNumber, sessionNames }) => {
      const runner = createFixtureRunner(null);
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        repository.listSessionNamesForIssueUrl(issueUrlFor(issueNumber)),
      ).resolves.toEqual(sessionNames);
    },
  );

  const failureRows: Array<{
    name: string;
    failedCommand: FailedCommand;
    stderr: string;
  }> = [
    {
      name: 'ps',
      failedCommand: 'ps',
      stderr: 'ps permission denied',
    },
    {
      name: 'tmux list-panes',
      failedCommand: 'list-panes',
      stderr: 'list-panes permission denied',
    },
  ];

  it.each(failureRows)(
    'rejects when $name exits non-zero',
    async ({ failedCommand, stderr }) => {
      const runner = createFixtureRunner({ failedCommand, stderr });
      const repository = new NodeTmuxSessionRepository(runner);

      await expect(
        asBatchingRepository(repository).listSessionNamesForIssueUrls(
          openIssueUrls,
        ),
      ).rejects.toThrow(stderr);
    },
  );

  it('returns no sessions for one issue URL when the tmux server is absent', async () => {
    const runner = createFixtureRunner({
      failedCommand: 'list-panes',
      stderr: 'no server running',
    });
    const repository = new NodeTmuxSessionRepository(runner);

    await expect(
      repository.listSessionNamesForIssueUrl(issueUrlFor(7)),
    ).resolves.toEqual([]);
  });

  it('returns an empty list for every requested issue URL when the tmux server is absent', async () => {
    const runner = createFixtureRunner({
      failedCommand: 'list-panes',
      stderr: 'no server running',
    });
    const repository = new NodeTmuxSessionRepository(runner);
    const issueUrls = [issueUrlFor(7), issueUrlFor(150)];

    await expect(
      asBatchingRepository(repository).listSessionNamesForIssueUrls(issueUrls),
    ).resolves.toEqual(
      new Map<string, string[]>(
        issueUrls.map((url): [string, string[]] => [url, []]),
      ),
    );
  });
});
