import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ProcSshSessionHostRepository } from './ProcSshSessionHostRepository';

const ISSUE_URL = 'https://github.com/example-org/example-repo/issues/12';

const WORKER_HOSTS_YAML = `hosts:
  - name: example-worker
    address: worker.example.invalid
    port: 2222
    user: worker
    tdpmBin: /opt/example/tdpm
`;

const launchCommandLine = (issueUrl: string): string =>
  [
    'ssh',
    '-tt',
    '-p',
    '2222',
    'worker@worker.example.invalid',
    `bash -ic 'set +m; : "Take ownership of ${issueUrl}"; export AW_RUN_LOCAL_ONLY=1'`,
  ].join('\0');

const environWithKey = (liveSessionKey: string | null): string =>
  [
    'PATH=/usr/bin',
    'CLAUDE_CODE_OAUTH_TOKEN=example-token-value',
    ...(liveSessionKey === null
      ? []
      : [`TDPM_REMOTE_LIVE_SESSION_KEY=${liveSessionKey}`]),
  ].join('\0');

type ProcessFixture = {
  processId: string;
  cmdline: string;
  environ: string;
};

const writeProcessFixtures = (
  procDirectory: string,
  fixtures: ProcessFixture[],
): void => {
  for (const fixture of fixtures) {
    const directory = path.join(procDirectory, fixture.processId);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'cmdline'), fixture.cmdline);
    fs.writeFileSync(path.join(directory, 'environ'), fixture.environ);
  }
};

describe('ProcSshSessionHostRepository.findHostOfIssueSession', () => {
  let root: string;
  let procDirectory: string;
  let hostsFile: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'proc-ssh-host-test-'));
    procDirectory = path.join(root, 'proc');
    fs.mkdirSync(procDirectory);
    hostsFile = path.join(root, 'worker-hosts.yaml');
    fs.writeFileSync(hostsFile, WORKER_HOSTS_YAML);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each<{
    name: string;
    fixtures: ProcessFixture[];
    hostsFilePath: string | null;
    expected: unknown;
  }>([
    {
      name: 'reports a local host when no ssh launch carries the issue',
      fixtures: [
        {
          processId: '100',
          cmdline: 'bash\0-i\0',
          environ: environWithKey(null),
        },
      ],
      hostsFilePath: null,
      expected: { kind: 'local' },
    },
    {
      name: 'resolves the remote host from the live session key of the ssh launch',
      fixtures: [
        {
          processId: '200',
          cmdline: launchCommandLine(ISSUE_URL),
          environ: environWithKey('example-worker:example-scope.scope'),
        },
      ],
      hostsFilePath: 'worker-hosts',
      expected: {
        kind: 'remote',
        name: 'example-worker',
        address: 'worker.example.invalid',
        port: 2222,
        user: 'worker',
      },
    },
    {
      name: 'reports an unknown remote host when the table lacks the host',
      fixtures: [
        {
          processId: '300',
          cmdline: launchCommandLine(ISSUE_URL),
          environ: environWithKey('unlisted-host:scope.scope'),
        },
      ],
      hostsFilePath: 'worker-hosts',
      expected: { kind: 'unknownRemote', name: 'unlisted-host' },
    },
    {
      name: 'reports an unknown remote host when the launch has no live session key',
      fixtures: [
        {
          processId: '400',
          cmdline: launchCommandLine(ISSUE_URL),
          environ: environWithKey(null),
        },
      ],
      hostsFilePath: 'worker-hosts',
      expected: { kind: 'unknownRemote', name: 'unidentified' },
    },
    {
      name: 'ignores a process that mentions the issue but is not ssh',
      fixtures: [
        {
          processId: '500',
          cmdline: `bash\0-ic\0: "Take ownership of ${ISSUE_URL}"`,
          environ: environWithKey('example-worker:scope.scope'),
        },
      ],
      hostsFilePath: 'worker-hosts',
      expected: { kind: 'local' },
    },
    {
      name: 'does not match an ssh launch for a longer issue number',
      fixtures: [
        {
          processId: '600',
          cmdline: launchCommandLine(`${ISSUE_URL}3`),
          environ: environWithKey('example-worker:scope.scope'),
        },
      ],
      hostsFilePath: 'worker-hosts',
      expected: { kind: 'local' },
    },
  ])('$name', ({ fixtures, hostsFilePath, expected }) => {
    writeProcessFixtures(procDirectory, fixtures);
    const repository = new ProcSshSessionHostRepository(
      hostsFilePath === null ? null : hostsFile,
      procDirectory,
    );
    expect(repository.findHostOfIssueSession(ISSUE_URL)).toEqual(expected);
  });

  it('reports an unknown remote host when no worker host table exists', () => {
    writeProcessFixtures(procDirectory, [
      {
        processId: '700',
        cmdline: launchCommandLine(ISSUE_URL),
        environ: environWithKey('example-worker:scope.scope'),
      },
    ]);
    const repository = new ProcSshSessionHostRepository(
      path.join(root, 'missing.yaml'),
      procDirectory,
    );
    expect(repository.findHostOfIssueSession(ISSUE_URL)).toEqual({
      kind: 'unknownRemote',
      name: 'example-worker',
    });
  });

  it('rejects a worker host table with an entry that has an invalid field', () => {
    fs.writeFileSync(
      hostsFile,
      `hosts:\n  - name: "bad name"\n    address: worker.example.invalid\n    port: 22\n    user: worker\n`,
    );
    writeProcessFixtures(procDirectory, [
      {
        processId: '800',
        cmdline: launchCommandLine(ISSUE_URL),
        environ: environWithKey('bad name:scope.scope'),
      },
    ]);
    const repository = new ProcSshSessionHostRepository(
      hostsFile,
      procDirectory,
    );
    expect(() => repository.findHostOfIssueSession(ISSUE_URL)).toThrow(
      'worker host entry 0 ("bad name") has an invalid name, address, port or user',
    );
  });
});
