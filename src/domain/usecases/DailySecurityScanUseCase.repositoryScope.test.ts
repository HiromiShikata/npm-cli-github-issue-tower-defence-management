import {
  DailySecurityScanConfig,
  DailySecurityScanUseCase,
} from './DailySecurityScanUseCase';
import { LocalCommandRunner } from './adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
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
    createCommentByUrl: async (url, body) => {
      commentedUrls.push({ url, body });
      return {
        id: commentedUrls.length,
        body,
        createdAt: '2024-03-05T10:15:00.000Z',
      } as unknown as Awaited<ReturnType<IssueRepository['createCommentByUrl']>>;
    },
    getIssueOrPullRequestComments: async (url) =>
      commentedUrls
        .filter((comment) => comment.url === url)
        .map((comment) => ({
          body: comment.body,
          createdAt: '2024-03-05T10:15:00.000Z',
        })) as unknown as Awaited<
        ReturnType<IssueRepository['getIssueOrPullRequestComments']>
      >,
  };

  const httpRepository: HttpRepository = {
    get: async () => {
      throw new Error('The CISA KEV catalog must not be fetched');
    },
  } as HttpRepository;

  const kevReportWatermarkRepository: KevReportWatermarkRepository = {
    load: async () => ({ type: 'absent' }),
    save: async () => undefined,
  };

  const dailySecurityScanRunLogRepository: DailySecurityScanRunLogRepository =
    {
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
) =>
  useCase.run({
    targetDates: [new Date('2024-01-02T05:00:00Z')],
    org: ORG,
    manager: MANAGER,
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
        repositories: [{ directory: '/repos/client-org/client-app', remoteUrl }],
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
    expect(snapshot.commentedUrls[0].body).toContain(
      '## OSV-Scanner findings',
    );
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
