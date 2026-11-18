import {
  DailySecurityScanConfig,
  DailySecurityScanUseCase,
} from './DailySecurityScanUseCase';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import {
  IssueComment,
  IssueRepository,
} from './adapter-interfaces/IssueRepository';
import { HttpRepository } from './adapter-interfaces/HttpRepository';
import { KevReportWatermarkRepository } from './adapter-interfaces/KevReportWatermarkRepository';
import { DailySecurityScanRunLogRepository } from './adapter-interfaces/DailySecurityScanRunLogRepository';
import { DailySecurityScanRunLogEntry } from '../entities/DailySecurityScanRunLogEntry';

const ORG = 'example-org';
const MANAGER = 'manager-name';
const FINDINGS_TITLE = 'Daily security scan findings';
const COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const CLEAN_SCAN = { exitCode: 0, stdout: '{"results":[]}', stderr: '' };

type ScanOutcome = { exitCode: number; stdout: string; stderr: string };
type CheckoutRepository = { directory: string; remoteUrl: string };
type FakeIssue = {
  url: string;
  owner: string;
  repositoryName: string;
  title: string;
};

const vulnerableScan = (cveId: string): ScanOutcome => ({
  exitCode: 1,
  stdout: JSON.stringify({
    results: [
      {
        packages: [
          {
            package: { ecosystem: 'npm', name: 'left-pad', version: '1.0.0' },
            vulnerabilities: [
              {
                id: 'GHSA-test-0001',
                aliases: [cveId],
                summary: 'test summary',
              },
            ],
          },
        ],
      },
    ],
  }),
  stderr: '',
});

type ScanEnvironmentOptions = {
  repositories: CheckoutRepository[];
  scanByRemoteUrl?: Record<string, ScanOutcome>;
  cloneFailingRemoteUrls?: string[];
  existingIssues?: FakeIssue[];
  failingCreateRepositoryKeys?: string[];
  failingSearchRepositoryKeys?: string[];
};

const repositoryKey = (owner: string, repositoryName: string): string =>
  `${owner}/${repositoryName}`;

// In-memory fakes of every adapter the use case depends on. The fake GitHub
// returns every issue of a repository from searchIssue, so the use case's own
// exact-title filter is what decides which issue it updates.
const buildScanEnvironment = (options: ScanEnvironmentOptions) => {
  const remoteByDirectory = new Map(
    options.repositories.map((repository) => [
      repository.directory,
      repository.remoteUrl,
    ]),
  );
  const remoteByCheckoutDirectory = new Map<string, string>();
  const clonedRemoteUrls: string[] = [];
  const searchCalls: Parameters<IssueRepository['searchIssue']>[0][] = [];
  const createdIssues: {
    owner: string;
    repositoryName: string;
    title: string;
    body: string;
  }[] = [];
  const commentedUrls: { url: string; body: string }[] = [];
  const runLogEntries: DailySecurityScanRunLogEntry[] = [];
  const issues: FakeIssue[] = [...(options.existingIssues ?? [])];
  let scannerInvocations = 0;
  let checkoutCounter = 0;

  const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0 });

  const localCommandRunner: LocalCommandRunner = {
    runCommand: async (program, args) => {
      if (program === 'find') {
        return ok(
          options.repositories
            .map((repository) => `${repository.directory}/.git`)
            .join('\n') + '\n',
        );
      }
      if (program === 'git' && args[0] === '-C' && args[2] === 'remote') {
        return ok(`${remoteByDirectory.get(args[1]) ?? ''}\n`);
      }
      if (program === 'mktemp') {
        checkoutCounter += 1;
        return ok(`/tmp/fake-checkout-${checkoutCounter}\n`);
      }
      if (program === 'git' && args[0] === 'clone') {
        const remoteUrl = args[3];
        const checkoutDirectory = args[4];
        remoteByCheckoutDirectory.set(checkoutDirectory, remoteUrl);
        clonedRemoteUrls.push(remoteUrl);
        if ((options.cloneFailingRemoteUrls ?? []).includes(remoteUrl)) {
          return { stdout: '', stderr: 'fatal: clone failed', exitCode: 128 };
        }
        return ok('');
      }
      if (program === 'git' && args[0] === '-C' && args[2] === 'rev-parse') {
        return ok(`${COMMIT_SHA}\n`);
      }
      if (program === 'osv-scanner') {
        scannerInvocations += 1;
        const remoteUrl = remoteByCheckoutDirectory.get(args[3]) ?? '';
        return options.scanByRemoteUrl?.[remoteUrl] ?? CLEAN_SCAN;
      }
      return ok('');
    },
    spawnInteractive: () => {
      throw new Error('spawnInteractive is not used by the daily scan');
    },
  };

  const issueRepository: Pick<
    IssueRepository,
    | 'createNewIssue'
    | 'searchIssue'
    | 'createCommentByUrl'
    | 'getIssueOrPullRequestComments'
  > = {
    searchIssue: async (query) => {
      searchCalls.push(query);
      if (
        (options.failingSearchRepositoryKeys ?? []).includes(
          repositoryKey(query.owner, query.repositoryName),
        )
      ) {
        throw new Error(
          `search failed for ${repositoryKey(query.owner, query.repositoryName)}`,
        );
      }
      return issues
        .filter(
          (issue) =>
            issue.owner === query.owner &&
            issue.repositoryName === query.repositoryName,
        )
        .map((issue) => ({ url: issue.url, title: issue.title, number: '1' }));
    },
    createNewIssue: async (owner, repositoryName, title, body) => {
      if (
        (options.failingCreateRepositoryKeys ?? []).includes(
          repositoryKey(owner, repositoryName),
        )
      ) {
        throw new Error(
          `create failed for ${repositoryKey(owner, repositoryName)}`,
        );
      }
      createdIssues.push({ owner, repositoryName, title, body });
      const url = `https://github.com/${owner}/${repositoryName}/issues/${createdIssues.length}`;
      issues.push({ url, owner, repositoryName, title });
      return createdIssues.length;
    },
    createCommentByUrl: async (url, body): Promise<IssueComment> => {
      commentedUrls.push({ url, body });
      return {
        id: commentedUrls.length,
        author: 'fake-author',
        body,
        createdAt: new Date('2024-03-05T10:15:00.000Z'),
      };
    },
    getIssueOrPullRequestComments: async (url): Promise<IssueComment[]> =>
      commentedUrls
        .filter((comment) => comment.url === url)
        .map((comment, index) => ({
          id: index + 1,
          author: 'fake-author',
          body: comment.body,
          createdAt: new Date('2024-03-05T10:15:00.000Z'),
        })),
  };

  const httpRepository: HttpRepository = {
    get: async () => {
      throw new Error('The CISA KEV catalog must not be fetched');
    },
  };

  const kevReportWatermarkRepository: KevReportWatermarkRepository = {
    load: async () => ({ type: 'absent' }),
    save: async () => undefined,
  };

  const dailySecurityScanRunLogRepository: DailySecurityScanRunLogRepository = {
    append: async (entry) => {
      runLogEntries.push(entry);
    },
  };

  const useCase = new DailySecurityScanUseCase(
    localCommandRunner,
    issueRepository,
    httpRepository,
    kevReportWatermarkRepository,
    dailySecurityScanRunLogRepository,
    () => new Date('2024-03-05T10:15:00.000Z'),
    async () => undefined,
  );

  const snapshot = () => ({
    clonedRemoteUrls: [...clonedRemoteUrls],
    scannerInvocations,
    searchCalls: [...searchCalls],
    createdIssues: [...createdIssues],
    commentedUrls: [...commentedUrls],
    runLogEntries: [...runLogEntries],
  });

  return { useCase, snapshot };
};

const runScan = (
  useCase: DailySecurityScanUseCase,
  dailySecurityScan: Partial<DailySecurityScanConfig> = {},
  repositories?: string[] | null,
) =>
  useCase.run({
    targetDates: [new Date('2024-01-02T05:00:00Z')],
    org: ORG,
    manager: MANAGER,
    ...(repositories === undefined ? {} : { repositories }),
    dailySecurityScan: {
      scanBaseDirectory: '/repos',
      targetHourUtc: 5,
      ...dailySecurityScan,
    },
  });

describe('DailySecurityScanUseCase repository scope without a repositories list', () => {
  it('scans an org-owned repository from every remote URL form and writes its findings to that repository', async () => {
    const remoteUrls = [
      'git@github.com:example-org/app.git',
      'https://github.com/example-org/app',
      'https://github.com/example-org/app.git',
    ];
    for (const remoteUrl of remoteUrls) {
      const environment = buildScanEnvironment({
        repositories: [{ directory: '/repos/example-org/app', remoteUrl }],
        scanByRemoteUrl: { [remoteUrl]: vulnerableScan('CVE-2024-0001') },
      });

      await runScan(environment.useCase);

      expect({ remoteUrl, ...environment.snapshot() }).toMatchObject({
        remoteUrl,
        clonedRemoteUrls: [remoteUrl],
        scannerInvocations: 1,
        searchCalls: [
          {
            owner: ORG,
            repositoryName: 'app',
            type: 'issue',
            state: 'open',
            title: FINDINGS_TITLE,
          },
        ],
        createdIssues: [
          { owner: ORG, repositoryName: 'app', title: FINDINGS_TITLE },
        ],
      });
    }
  });

  it('never clones, scans or writes to a repository whose origin owner is not the org', async () => {
    const remoteUrls = [
      'git@github.com:client-org/client-app.git',
      'https://github.com/client-org/client-app',
    ];
    for (const remoteUrl of remoteUrls) {
      const environment = buildScanEnvironment({
        repositories: [
          { directory: '/repos/client-org/client-app', remoteUrl },
        ],
        scanByRemoteUrl: { [remoteUrl]: vulnerableScan('CVE-2024-0002') },
      });

      await runScan(environment.useCase);

      expect({ remoteUrl, ...environment.snapshot() }).toEqual({
        remoteUrl,
        clonedRemoteUrls: [],
        scannerInvocations: 0,
        searchCalls: [],
        createdIssues: [],
        commentedUrls: [],
        runLogEntries: [],
      });
    }
  });

  it('comments on the open issue whose title is exactly the findings title and creates nothing', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/example-org/app',
          remoteUrl: 'git@github.com:example-org/app.git',
        },
      ],
      scanByRemoteUrl: {
        'git@github.com:example-org/app.git': vulnerableScan('CVE-2024-0003'),
      },
      existingIssues: [
        {
          url: 'https://github.com/example-org/app/issues/7',
          owner: ORG,
          repositoryName: 'app',
          title: FINDINGS_TITLE,
        },
      ],
    });

    await runScan(environment.useCase);

    const snapshot = environment.snapshot();
    expect(snapshot.createdIssues).toEqual([]);
    expect(snapshot.commentedUrls).toHaveLength(1);
    expect(snapshot.commentedUrls[0].url).toBe(
      'https://github.com/example-org/app/issues/7',
    );
    expect(snapshot.commentedUrls[0].body).toContain('## OSV-Scanner findings');
  });

  it('records a clean scan in the run log without creating or updating any issue', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/example-org/app',
          remoteUrl: 'git@github.com:example-org/app.git',
        },
      ],
    });

    await runScan(environment.useCase);

    const snapshot = environment.snapshot();
    expect(snapshot.createdIssues).toEqual([]);
    expect(snapshot.commentedUrls).toEqual([]);
    expect(snapshot.runLogEntries).toMatchObject([
      {
        repositoryName: 'app',
        outcome: { type: 'scanCompletedClean', clonedCommitSha: COMMIT_SHA },
      },
    ]);
  });
});

describe('DailySecurityScanUseCase repository scope with a repositories list and a findings repository', () => {
  const CLIENT_SCP_REMOTE = 'git@github.com:client-org/client-app.git';
  const DESTINATION = 'security-tasks';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects scanned repositories by the repositories list, case-insensitively, regardless of owner when the list is set', async () => {
    const cases: {
      label: string;
      repositories: string[] | null | undefined;
      remoteUrl: string;
      expectedScanned: boolean;
    }[] = [
      {
        label: 'list absent, org-owned repository',
        repositories: undefined,
        remoteUrl: 'git@github.com:example-org/app.git',
        expectedScanned: true,
      },
      {
        label: 'list absent, other-owner repository',
        repositories: undefined,
        remoteUrl: CLIENT_SCP_REMOTE,
        expectedScanned: false,
      },
      {
        label: 'list present, listed other-owner repository (scp URL)',
        repositories: ['client-org/client-app'],
        remoteUrl: CLIENT_SCP_REMOTE,
        expectedScanned: true,
      },
      {
        label: 'list present, listed other-owner repository (https URL)',
        repositories: ['client-org/client-app'],
        remoteUrl: 'https://github.com/client-org/client-app',
        expectedScanned: true,
      },
      {
        label: 'list present with different letter case',
        repositories: ['Client-Org/Client-App'],
        remoteUrl: 'https://github.com/client-org/client-app.git',
        expectedScanned: true,
      },
      {
        label: 'list present, org-owned repository that is not listed',
        repositories: ['client-org/client-app'],
        remoteUrl: 'git@github.com:example-org/app.git',
        expectedScanned: false,
      },
      {
        label: 'list present, other-owner repository that is not listed',
        repositories: ['client-org/client-app'],
        remoteUrl: 'git@github.com:client-org/other-app.git',
        expectedScanned: false,
      },
      {
        label: 'list present, repository name containing a dot',
        repositories: ['client-org/app.v2'],
        remoteUrl: 'git@github.com:client-org/app.v2.git',
        expectedScanned: true,
      },
      {
        label: 'list present but empty',
        repositories: [],
        remoteUrl: 'git@github.com:example-org/app.git',
        expectedScanned: false,
      },
    ];

    for (const testCase of cases) {
      const environment = buildScanEnvironment({
        repositories: [
          { directory: '/repos/checkout', remoteUrl: testCase.remoteUrl },
        ],
        scanByRemoteUrl: {
          [testCase.remoteUrl]: vulnerableScan('CVE-2024-1001'),
        },
      });

      await runScan(environment.useCase, {}, testCase.repositories);

      expect({
        label: testCase.label,
        scanned: environment
          .snapshot()
          .clonedRemoteUrls.includes(testCase.remoteUrl),
      }).toEqual({ label: testCase.label, scanned: testCase.expectedScanned });
    }
  });

  it('writes each scanned repository findings to the findings repository under a title naming that repository', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
        {
          directory: '/repos/client-org/client-api',
          remoteUrl: 'https://github.com/client-org/client-api',
        },
      ],
      scanByRemoteUrl: {
        [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1002'),
        'https://github.com/client-org/client-api':
          vulnerableScan('CVE-2024-1003'),
      },
    });

    await runScan(environment.useCase, { findingsRepo: DESTINATION }, [
      'client-org/client-app',
      'client-org/client-api',
    ]);

    const snapshot = environment.snapshot();
    expect(
      snapshot.searchCalls.map((call) => [
        call.owner,
        call.repositoryName,
        call.title,
      ]),
    ).toEqual([
      [ORG, DESTINATION, 'Daily security scan findings: client-org/client-app'],
      [ORG, DESTINATION, 'Daily security scan findings: client-org/client-api'],
    ]);
    expect(
      snapshot.createdIssues.map((issue) => [
        issue.owner,
        issue.repositoryName,
        issue.title,
      ]),
    ).toEqual([
      [ORG, DESTINATION, 'Daily security scan findings: client-org/client-app'],
      [ORG, DESTINATION, 'Daily security scan findings: client-org/client-api'],
    ]);
    expect(snapshot.createdIssues[0].body).toContain('## OSV-Scanner findings');
    expect(snapshot.commentedUrls).toEqual([]);
  });

  it('comments on the destination issue with the exact title of the scanned repository and ignores the plain or other-repository titles', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
      ],
      scanByRemoteUrl: { [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1004') },
      existingIssues: [
        {
          url: 'https://github.com/example-org/security-tasks/issues/3',
          owner: ORG,
          repositoryName: DESTINATION,
          title: FINDINGS_TITLE,
        },
        {
          url: 'https://github.com/example-org/security-tasks/issues/4',
          owner: ORG,
          repositoryName: DESTINATION,
          title: 'Daily security scan findings: example-org/app',
        },
        {
          url: 'https://github.com/example-org/security-tasks/issues/5',
          owner: ORG,
          repositoryName: DESTINATION,
          title: 'Daily security scan findings: client-org/client-app',
        },
      ],
    });

    await runScan(environment.useCase, { findingsRepo: DESTINATION }, [
      'client-org/client-app',
    ]);

    const snapshot = environment.snapshot();
    expect(snapshot.createdIssues).toEqual([]);
    expect(snapshot.commentedUrls.map((comment) => comment.url)).toEqual([
      'https://github.com/example-org/security-tasks/issues/5',
    ]);
  });

  it('never searches, creates or comments in the scanned repository itself when the findings repository is set', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
      ],
      scanByRemoteUrl: { [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1005') },
    });

    await runScan(environment.useCase, { findingsRepo: DESTINATION }, [
      'client-org/client-app',
    ]);

    const snapshot = environment.snapshot();
    const touchedScannedRepository = [
      ...snapshot.searchCalls.map((call) => [call.owner, call.repositoryName]),
      ...snapshot.createdIssues.map((issue) => [
        issue.owner,
        issue.repositoryName,
      ]),
    ].some(([owner]) => owner === 'client-org');
    expect(touchedScannedRepository).toBe(false);
    expect(snapshot.commentedUrls).toEqual([]);
  });

  it('keeps the current findings destination and title when the findings repository is not set and the list is', async () => {
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
      ],
      scanByRemoteUrl: { [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1006') },
    });

    await runScan(environment.useCase, {}, ['client-org/client-app']);

    expect(environment.snapshot().createdIssues).toMatchObject([
      {
        owner: 'client-org',
        repositoryName: 'client-app',
        title: FINDINGS_TITLE,
      },
    ]);
  });

  it('logs a failed findings write with the scanned repository and destination, and still scans the remaining repositories', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
        {
          directory: '/repos/client-org/client-api',
          remoteUrl: 'https://github.com/client-org/client-api',
        },
      ],
      scanByRemoteUrl: {
        [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1007'),
        'https://github.com/client-org/client-api':
          vulnerableScan('CVE-2024-1008'),
      },
      failingCreateRepositoryKeys: [`${ORG}/${DESTINATION}`],
    });

    await runScan(environment.useCase, { findingsRepo: DESTINATION }, [
      'client-org/client-app',
      'client-org/client-api',
    ]);

    const snapshot = environment.snapshot();
    expect(snapshot.scannerInvocations).toBe(2);
    expect(snapshot.runLogEntries.map((entry) => entry.repositoryName)).toEqual(
      ['client-app', 'client-api'],
    );
    const loggedMessages = consoleErrorSpy.mock.calls.map((call) =>
      String(call[0]),
    );
    expect(loggedMessages).toHaveLength(2);
    for (const repositoryName of [
      'client-org/client-app',
      'client-org/client-api',
    ]) {
      expect(
        loggedMessages.some(
          (message) =>
            message.includes(repositoryName) &&
            message.includes(`${ORG}/${DESTINATION}`) &&
            message.includes(`create failed for ${ORG}/${DESTINATION}`),
        ),
      ).toBe(true);
    }
  });

  it('logs a failed existing-issue search with the scanned repository and continues with the next repository', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
      ],
      scanByRemoteUrl: { [CLIENT_SCP_REMOTE]: vulnerableScan('CVE-2024-1009') },
      failingSearchRepositoryKeys: [`${ORG}/${DESTINATION}`],
    });

    await runScan(environment.useCase, { findingsRepo: DESTINATION }, [
      'client-org/client-app',
    ]);

    const snapshot = environment.snapshot();
    expect(snapshot.scannerInvocations).toBe(1);
    expect(snapshot.runLogEntries).toHaveLength(1);
    expect(snapshot.createdIssues).toEqual([]);
    expect(
      consoleErrorSpy.mock.calls.some(
        (call) =>
          String(call[0]).includes('client-org/client-app') &&
          String(call[0]).includes(
            'search failed for example-org/security-tasks',
          ),
      ),
    ).toBe(true);
  });

  it('logs a failed clone of a listed repository and still scans the remaining listed repositories', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
        {
          directory: '/repos/client-org/client-api',
          remoteUrl: 'https://github.com/client-org/client-api',
        },
      ],
      scanByRemoteUrl: {
        'https://github.com/client-org/client-api':
          vulnerableScan('CVE-2024-1010'),
      },
      cloneFailingRemoteUrls: [CLIENT_SCP_REMOTE],
    });

    await runScan(environment.useCase, {}, [
      'client-org/client-app',
      'client-org/client-api',
    ]);

    const snapshot = environment.snapshot();
    expect(
      snapshot.runLogEntries.map((entry) => [
        entry.repositoryName,
        entry.outcome.type,
      ]),
    ).toEqual([
      ['client-app', 'checkoutFailed'],
      ['client-api', 'scanCompletedWithVulnerabilities'],
    ]);
    expect(
      consoleErrorSpy.mock.calls.some(
        (call) =>
          String(call[0]).includes('client-org/client-app') ||
          String(call[0]).includes(
            'Failed to clone the default branch of client-app',
          ),
      ),
    ).toBe(true);
  });

  it('records an unexpected osv-scanner exit for a listed repository as a scan failure and continues', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const environment = buildScanEnvironment({
      repositories: [
        {
          directory: '/repos/client-org/client-app',
          remoteUrl: CLIENT_SCP_REMOTE,
        },
        {
          directory: '/repos/client-org/client-api',
          remoteUrl: 'https://github.com/client-org/client-api',
        },
      ],
      scanByRemoteUrl: {
        [CLIENT_SCP_REMOTE]: {
          exitCode: 2,
          stdout: '',
          stderr: 'scanner crashed',
        },
        'https://github.com/client-org/client-api': CLEAN_SCAN,
      },
    });

    await runScan(environment.useCase, {}, [
      'client-org/client-app',
      'client-org/client-api',
    ]);

    const snapshot = environment.snapshot();
    expect(
      snapshot.runLogEntries.map((entry) => [
        entry.repositoryName,
        entry.outcome.type,
      ]),
    ).toEqual([
      ['client-app', 'scanFailed'],
      ['client-api', 'scanCompletedClean'],
    ]);
    expect(
      consoleErrorSpy.mock.calls.some((call) =>
        String(call[0]).includes(
          'osv-scanner failed with exit code 2 for client-app',
        ),
      ),
    ).toBe(true);
  });
});
