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
      { token: 'token-a', logPath: '/logs-aw/x.log' },
      { token: 'token-a', logPath: '/logs-aw/x.log' },
      { token: 'token-a', logPath: '/logs-aw/y.log' },
    ];

    writeTokenStatus({
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
      spawnRepository: { listSpawns: () => spawns },
    });

    const written = readJson(path.join(dir, 'token-status.json'));
    const expected: TokenStatusFile = {
      capturedAt: '2026-06-26T12:00:00.000Z',
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
      spawnRepository: { listSpawns: () => [] },
    };

    writeTokenStatus({
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
    };
    expect(written).toEqual({
      capturedAt: '2026-06-26T12:00:00.000Z',
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
        },
      ],
    });
  });

  it('is a no-op when dashboardDataDir is unset', () => {
    writeTokenStatus({
      dashboardDataDir: null,
      tokenListJsonPath: tokenListPath,
      issues: [],
      readSnapshot: () => null,
      interactiveSessionRepository: { listInteractiveSessions: () => [] },
      spawnRepository: { listSpawns: () => [] },
    });
    expect(fs.existsSync(path.join(dir, 'token-status.json'))).toBe(false);
  });

  it('is a no-op when the token list path is unset', () => {
    writeTokenStatus({
      dashboardDataDir: dir,
      tokenListJsonPath: null,
      issues: [],
      readSnapshot: () => null,
      interactiveSessionRepository: { listInteractiveSessions: () => [] },
      spawnRepository: { listSpawns: () => [] },
    });
    expect(fs.existsSync(path.join(dir, 'token-status.json'))).toBe(false);
  });
});
