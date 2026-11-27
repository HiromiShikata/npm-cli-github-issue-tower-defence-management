import fs from 'fs';
import os from 'os';
import path from 'path';
import { Issue } from '../../../domain/entities/Issue';
import { ClaudeInteractiveSession } from '../../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TakeOwnershipSpawn } from '../../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
import { RateLimitSnapshot } from '../../proxy/RateLimitCache';
import { TokenStatusFile, writeTokenStatus } from './tokenStatusWriter';

const readJson = (filePath: string): unknown =>
  JSON.parse(fs.readFileSync(filePath, 'utf8'));

const ASSIGNEE = 'HiromiShikata';

const baseSnapshot = (
  overrides: Partial<RateLimitSnapshot> = {},
): RateLimitSnapshot => ({
  fiveHourUtilization: 0.1,
  fiveHourReset: 0,
  sevenDayUtilization: 0.1,
  sevenDayReset: 0,
  blocked: false,
  rejected: false,
  unifiedRejected: false,
  fiveHourRejected: false,
  sevenDayRejected: false,
  unifiedStatus: 'allowed',
  overageDisabledReason: null,
  modelWeeklyLimits: {},
  lastUpdatedEpoch: 0,
  blockedUntilEpoch: 0,
  subscriptionDisabled: false,
  ...overrides,
});

const makeIssue = (overrides: Partial<Issue>): Issue => ({
  nameWithOwner: 'demo/repo',
  number: 1,
  title: 'Issue',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: 'https://github.com/demo/repo/issues/1',
  assignees: [ASSIGNEE],
  labels: [],
  org: 'demo',
  repo: 'repo',
  body: '',
  itemId: 'item-1',
  isPr: false,
  isInProgress: false,
  isClosed: false,
  createdAt: new Date('2026-06-13T08:18:45.000Z'),
  author: 'someone',
  closingIssueReferenceUrls: [],
  plainCrossRepoIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
  ...overrides,
});

describe('writeTokenStatus', () => {
  let dir: string;
  let tokenListPath: string;
  const now = new Date('2026-06-26T12:00:00.000Z');
  const nowEpoch = Math.floor(now.getTime() / 1000);

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-status-'));
    tokenListPath = path.join(dir, 'tokens.json');
    fs.writeFileSync(
      tokenListPath,
      JSON.stringify([
        { name: 'alice', token: 'token-a' },
        { name: 'bob', token: 'token-b' },
      ]),
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes token-status.json with per-token color, util, prep and hum', () => {
    const interactiveSessions: ClaudeInteractiveSession[] = [
      {
        token: 'token-a',
        sessionId: 'session-1',
        issueUrl: 'https://github.com/demo/repo/issues/1',
      },
    ];
    const spawns: TakeOwnershipSpawn[] = [
      { token: 'token-a', logPath: '/logs-aw/x.log', issueUrl: null },
      { token: 'token-a', logPath: '/logs-aw/x.log', issueUrl: null },
      { token: 'token-a', logPath: '/logs-aw/y.log', issueUrl: null },
    ];

    writeTokenStatus({
      runningSubagentFactsRepository: { listFacts: () => [] },
      dashboardDataDir: dir,
      tokenListJsonPath: tokenListPath,
      issues: [
        makeIssue({
          status: 'In Tmux by human',
          url: 'https://github.com/demo/repo/issues/1',
        }),
      ],
      now,
      readSnapshot: (token) =>
        token === 'token-a'
          ? baseSnapshot({
              fiveHourUtilization: 0.42,
              fiveHourReset: nowEpoch + 3600,
              sevenDayUtilization: 0.5,
              sevenDayReset: nowEpoch + 86400,
            })
          : null,
      interactiveSessionRepository: {
        listInteractiveSessions: () => interactiveSessions,
      },
      spawnRepository: {
        listSpawns: () => spawns,
        listRunningIssueUrls: () => [],
      },
    });

    const written = readJson(path.join(dir, 'token-status.json'));
    const expected: TokenStatusFile = {
      capturedAt: '2026-06-26T12:00:00.000Z',
      sevenDayWindowAggregate: {
        usedPercent: 50,
        includedTokenCount: 1,
        totalTokenCount: 2,
      },
      tokens: [
        {
          name: 'alice',
          fiveHourUtilizationPercent: 42,
          fiveHourResetSeconds: 3600,
          sevenDayUtilizationPercent: 50,
          sevenDayResetSeconds: 86400,
          color: 'G',
          prep: 2,
          hum: 1,
          claudeSubagentCount: 0,
          codexSubagentCount: 0,
        },
        {
          name: 'bob',
          fiveHourUtilizationPercent: null,
          fiveHourResetSeconds: null,
          sevenDayUtilizationPercent: null,
          sevenDayResetSeconds: null,
          color: 'Y',
          prep: 0,
          hum: 0,
          claudeSubagentCount: 0,
          codexSubagentCount: 0,
        },
      ],
    };
    expect(written).toEqual(expected);
  });

  it('aggregates In-Tmux-by-human sessions across multiple projects, not just the last project written', () => {
    const interactiveSessions: ClaudeInteractiveSession[] = [
      {
        token: 'token-a',
        sessionId: 'session-project-a',
        issueUrl: 'https://github.com/demo/repo/issues/100',
      },
      {
        token: 'token-a',
        sessionId: 'session-project-b',
        issueUrl: 'https://github.com/demo/repo/issues/200',
      },
    ];
    const sharedRepositories = {
      readSnapshot: () => null,
      interactiveSessionRepository: {
        listInteractiveSessions: () => interactiveSessions,
      },
      spawnRepository: { listSpawns: () => [], listRunningIssueUrls: () => [] },
    };

    writeTokenStatus({
      runningSubagentFactsRepository: { listFacts: () => [] },
      dashboardDataDir: dir,
      tokenListJsonPath: tokenListPath,
      pjcode: 'projectA',
      issues: [
        makeIssue({
          status: 'In Tmux by human',
          url: 'https://github.com/demo/repo/issues/100',
        }),
      ],
      now,
      ...sharedRepositories,
    });

    writeTokenStatus({
      runningSubagentFactsRepository: { listFacts: () => [] },
      dashboardDataDir: dir,
      tokenListJsonPath: tokenListPath,
      pjcode: 'projectB',
      issues: [
        makeIssue({
          status: 'In Tmux by human',
          url: 'https://github.com/demo/repo/issues/200',
        }),
      ],
      now,
      ...sharedRepositories,
    });

    const written = readJson(path.join(dir, 'token-status.json'));
    const expectedAlice: TokenStatusFile['tokens'][number] = {
      name: 'alice',
      fiveHourUtilizationPercent: null,
      fiveHourResetSeconds: null,
      sevenDayUtilizationPercent: null,
      sevenDayResetSeconds: null,
      color: 'Y',
      prep: 0,
      hum: 2,
      claudeSubagentCount: 0,
      codexSubagentCount: 0,
    };
    expect(written).toEqual({
      capturedAt: '2026-06-26T12:00:00.000Z',
      sevenDayWindowAggregate: null,
      tokens: [
        expectedAlice,
        {
          name: 'bob',
          fiveHourUtilizationPercent: null,
          fiveHourResetSeconds: null,
          sevenDayUtilizationPercent: null,
          sevenDayResetSeconds: null,
          color: 'Y',
          prep: 0,
          hum: 0,
          claudeSubagentCount: 0,
          codexSubagentCount: 0,
        },
      ],
    });
  });

  it('is a no-op when dashboardDataDir is unset', () => {
    writeTokenStatus({
      runningSubagentFactsRepository: { listFacts: () => [] },
      dashboardDataDir: null,
      tokenListJsonPath: tokenListPath,
      issues: [],
      readSnapshot: () => null,
      interactiveSessionRepository: { listInteractiveSessions: () => [] },
      spawnRepository: { listSpawns: () => [], listRunningIssueUrls: () => [] },
    });
    expect(fs.existsSync(path.join(dir, 'token-status.json'))).toBe(false);
  });

  it('is a no-op when the token list path is unset', () => {
    writeTokenStatus({
      runningSubagentFactsRepository: { listFacts: () => [] },
      dashboardDataDir: dir,
      tokenListJsonPath: null,
      issues: [],
      readSnapshot: () => null,
      interactiveSessionRepository: { listInteractiveSessions: () => [] },
      spawnRepository: { listSpawns: () => [], listRunningIssueUrls: () => [] },
    });
    expect(fs.existsSync(path.join(dir, 'token-status.json'))).toBe(false);
  });
});

const ISSUE_URL_101 = 'https://github.com/example-org/example-repo/issues/101';
const ISSUE_URL_102 = 'https://github.com/example-org/example-repo/issues/102';
const ISSUE_URL_999 = 'https://github.com/example-org/example-repo/issues/999';

describe('writeTokenStatus subagent counts', () => {
  it('joins remote counts to the token whose local spawn has the same issue URL and ignores unmatched URLs', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'token-subagents-'),
    );
    const tokenListPath = path.join(directory, 'tokens.json');
    const reportError = jest.fn<void, [string]>();
    try {
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([
          { name: 'alpha', token: 'token-alpha' },
          { name: 'beta', token: 'token-beta' },
        ]),
      );
      fs.writeFileSync(
        path.join(directory, 'remote-machine-status.json'),
        JSON.stringify({
          machines: [
            {
              reachable: true,
              subagentCounts: {
                claudeByIssueUrl: {
                  [ISSUE_URL_101]: 2,
                  [ISSUE_URL_999]: 5,
                },
                codexByIssueUrl: {
                  [ISSUE_URL_101]: 1,
                  [ISSUE_URL_999]: 4,
                },
              },
              unmeasuredClaudeIssueUrls: [],
            },
          ],
        }),
      );
      writeTokenStatus({
        dashboardDataDir: directory,
        tokenListJsonPath: tokenListPath,
        issues: [],
        readSnapshot: () => null,
        interactiveSessionRepository: { listInteractiveSessions: () => [] },
        spawnRepository: {
          listSpawns: () => [
            {
              token: 'token-beta',
              logPath: '/logs-aw/beta.log',
              issueUrl: ISSUE_URL_101,
            },
          ],
          listRunningIssueUrls: () => [],
        },
        runningSubagentFactsRepository: {
          listFacts: () => [
            {
              pid: 10,
              ppid: 1,
              kind: 'claude-worker',
              workerKey: 'token-alpha',
              unfinishedClaudeSubagentCount: 3,
            },
            {
              pid: 11,
              ppid: 10,
              kind: 'codex-launcher',
              workerKey: null,
              unfinishedClaudeSubagentCount: null,
            },
          ],
        },
        reportError,
      });
      const written = readJson(path.join(directory, 'token-status.json'));
      if (
        written === null ||
        typeof written !== 'object' ||
        !('tokens' in written) ||
        !Array.isArray(written.tokens)
      ) {
        throw new Error('token-status.json tokens are malformed');
      }
      expect(written.tokens).toEqual([
        expect.objectContaining({
          name: 'alpha',
          claudeSubagentCount: 3,
          codexSubagentCount: 1,
        }),
        expect.objectContaining({
          name: 'beta',
          claudeSubagentCount: 2,
          codexSubagentCount: 1,
        }),
      ]);
      expect(reportError).toHaveBeenCalled();
      expect(reportError.mock.calls.flat().join(' ')).not.toContain(
        'token-beta',
      );
      expect(reportError.mock.calls.flat().join(' ')).not.toContain(
        'token-alpha',
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('marks the subagent counts of the token whose spawn has an unmeasured remote issue URL as unavailable', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'token-subagents-'),
    );
    const tokenListPath = path.join(directory, 'tokens.json');
    try {
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([
          { name: 'alpha', token: 'token-alpha' },
          { name: 'beta', token: 'token-beta' },
        ]),
      );
      fs.writeFileSync(
        path.join(directory, 'remote-machine-status.json'),
        JSON.stringify({
          machines: [
            {
              reachable: true,
              subagentCounts: {
                claudeByIssueUrl: { [ISSUE_URL_101]: 2 },
                codexByIssueUrl: { [ISSUE_URL_101]: 1 },
              },
              unmeasuredClaudeIssueUrls: [ISSUE_URL_102],
            },
          ],
        }),
      );
      writeTokenStatus({
        dashboardDataDir: directory,
        tokenListJsonPath: tokenListPath,
        issues: [],
        readSnapshot: () => null,
        interactiveSessionRepository: { listInteractiveSessions: () => [] },
        spawnRepository: {
          listSpawns: () => [
            {
              token: 'token-alpha',
              logPath: '/logs-aw/alpha.log',
              issueUrl: ISSUE_URL_101,
            },
            {
              token: 'token-beta',
              logPath: '/logs-aw/beta.log',
              issueUrl: ISSUE_URL_102,
            },
          ],
          listRunningIssueUrls: () => [],
        },
        runningSubagentFactsRepository: { listFacts: () => [] },
      });
      const written = readJson(path.join(directory, 'token-status.json'));
      if (
        written === null ||
        typeof written !== 'object' ||
        !('tokens' in written) ||
        !Array.isArray(written.tokens)
      ) {
        throw new Error('token-status.json tokens are malformed');
      }
      expect(written.tokens).toEqual([
        expect.objectContaining({
          name: 'alpha',
          claudeSubagentCount: 2,
          codexSubagentCount: 1,
        }),
        expect.objectContaining({
          name: 'beta',
          claudeSubagentCount: null,
          codexSubagentCount: null,
        }),
      ]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('marks only the token of an unreadable worker as unavailable', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'token-subagents-'),
    );
    const tokenListPath = path.join(directory, 'tokens.json');
    try {
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([
          { name: 'alpha', token: 'token-alpha' },
          { name: 'beta', token: 'token-beta' },
        ]),
      );
      writeTokenStatus({
        dashboardDataDir: directory,
        tokenListJsonPath: tokenListPath,
        issues: [],
        readSnapshot: () => null,
        interactiveSessionRepository: { listInteractiveSessions: () => [] },
        spawnRepository: {
          listSpawns: () => [],
          listRunningIssueUrls: () => [],
        },
        runningSubagentFactsRepository: {
          listFacts: () => [
            {
              pid: 10,
              ppid: 1,
              kind: 'claude-worker',
              workerKey: 'token-alpha',
              unfinishedClaudeSubagentCount: null,
            },
            {
              pid: 20,
              ppid: 1,
              kind: 'claude-worker',
              workerKey: 'token-beta',
              unfinishedClaudeSubagentCount: 2,
            },
            {
              pid: 21,
              ppid: 20,
              kind: 'codex-launcher',
              workerKey: null,
              unfinishedClaudeSubagentCount: null,
            },
          ],
        },
      });
      const written = readJson(path.join(directory, 'token-status.json'));
      if (
        written === null ||
        typeof written !== 'object' ||
        !('tokens' in written) ||
        !Array.isArray(written.tokens)
      ) {
        throw new Error('token-status.json tokens are malformed');
      }
      expect(written.tokens).toEqual([
        expect.objectContaining({
          name: 'alpha',
          claudeSubagentCount: null,
          codexSubagentCount: null,
        }),
        expect.objectContaining({
          name: 'beta',
          claudeSubagentCount: 2,
          codexSubagentCount: 1,
        }),
      ]);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('logs every unreadable worker pid without logging token values', () => {
    const reportError = jest.fn();
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'token-subagents-'),
    );
    const tokenListPath = path.join(directory, 'tokens.json');
    try {
      fs.writeFileSync(
        tokenListPath,
        JSON.stringify([{ name: 'alpha', token: 'token-alpha' }]),
      );
      writeTokenStatus({
        dashboardDataDir: directory,
        tokenListJsonPath: tokenListPath,
        issues: [],
        readSnapshot: () => null,
        interactiveSessionRepository: { listInteractiveSessions: () => [] },
        spawnRepository: {
          listSpawns: () => [],
          listRunningIssueUrls: () => [],
        },
        runningSubagentFactsRepository: {
          listFacts: () => [
            {
              pid: 10,
              ppid: 1,
              kind: 'claude-worker',
              workerKey: 'token-alpha',
              unfinishedClaudeSubagentCount: null,
            },
          ],
        },
        reportError,
      });
      expect(reportError).toHaveBeenCalledWith(expect.stringContaining('10'));
      expect(reportError.mock.calls.flat().join(' ')).not.toContain(
        'token-alpha',
      );
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
