import { ClaudeInteractiveSession } from '../adapter-interfaces/ClaudeInteractiveSessionRepository';
import { ClaudeInteractiveSessionRepository } from '../adapter-interfaces/ClaudeInteractiveSessionRepository';
import {
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from '../adapter-interfaces/TokenRateLimitSnapshotRepository';
import { TmuxSessionRepository } from '../adapter-interfaces/TmuxSessionRepository';
import { toTmuxSessionName } from './InTmuxByHumanSessionReconcileUseCase';
import {
  DEFAULT_GRACE_PERIOD_SECONDS,
  DEFAULT_HANDOVER_MESSAGE,
  DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS,
  TokenExhaustionHandoverUseCase,
} from './TokenExhaustionHandoverUseCase';

const NOW_EPOCH = 1_750_000_000;
const ISSUE_URL = 'https://github.com/demo/repo/issues/42';
const TOKEN = 'sk-ant-test-token';
const SESSION_ID = 'session-abc';

const makeSession = (
  overrides: Partial<ClaudeInteractiveSession> = {},
): ClaudeInteractiveSession => ({
  token: TOKEN,
  sessionId: SESSION_ID,
  issueUrl: ISSUE_URL,
  ...overrides,
});

const makeSnapshot = (
  overrides: Partial<TokenRateLimitSnapshot> = {},
): TokenRateLimitSnapshot => ({
  fiveHourUtilization: 0.5,
  sevenDayUtilization: 0.5,
  blocked: false,
  rejected: false,
  blockedUntilEpoch: 0,
  lastUpdatedEpoch: NOW_EPOCH - 60,
  ...overrides,
});

const createFakeSessionRepository = (
  sessions: ClaudeInteractiveSession[],
): ClaudeInteractiveSessionRepository => ({
  listInteractiveSessions: () => sessions,
});

const createFakeSnapshotRepository = (
  snapshots: Map<string, TokenRateLimitSnapshot | null>,
): TokenRateLimitSnapshotRepository => ({
  getSnapshot: (token) => snapshots.get(token) ?? null,
});

type TmuxCalls = {
  sentKeys: { sessionName: string; text: string }[];
  killedSessions: string[];
};

const createFakeTmuxRepository = (calls: TmuxCalls): TmuxSessionRepository => ({
  listLiveSessionNames: async () => [],
  listLiveSessionsWithActivity: async () => [],
  listInteractiveProcessCommandLines: async () => [],
  launchDetachedSession: async () => undefined,
  sendKeys: async (sessionName, literalText) => {
    calls.sentKeys.push({ sessionName, text: literalText });
  },
  killSession: async (sessionName) => {
    calls.killedSessions.push(sessionName);
  },
});

const defaultInput = (
  overrides: Partial<Parameters<TokenExhaustionHandoverUseCase['run']>[0]> = {},
): Parameters<TokenExhaustionHandoverUseCase['run']>[0] => ({
  nowEpochSeconds: NOW_EPOCH,
  handoverMessageText: DEFAULT_HANDOVER_MESSAGE,
  gracePeriodSeconds: DEFAULT_GRACE_PERIOD_SECONDS,
  rateLimitStaleThresholdSeconds: DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS,
  dryRun: false,
  sentHandoverTimestamps: new Map(),
  ...overrides,
});

describe('TokenExhaustionHandoverUseCase', () => {
  it('returns empty results when there are no active sessions', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([]),
      createFakeSnapshotRepository(new Map()),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([]);
    expect(result.killedIssueUrls).toEqual([]);
    expect(calls.sentKeys).toHaveLength(0);
  });

  it('skips a session that has no rate limit snapshot', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, null]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([]);
    expect(calls.sentKeys).toHaveLength(0);
  });

  it('skips a session whose snapshot is stale', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const staleSnapshot = makeSnapshot({
      fiveHourUtilization: 0.95,
      lastUpdatedEpoch: NOW_EPOCH - DEFAULT_RATE_LIMIT_STALE_THRESHOLD_SECONDS - 1,
    });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, staleSnapshot]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([]);
    expect(calls.sentKeys).toHaveLength(0);
  });

  it('skips a session whose token is not exhausted', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const healthySnapshot = makeSnapshot({
      fiveHourUtilization: 0.5,
      sevenDayUtilization: 0.5,
      blocked: false,
      rejected: false,
      blockedUntilEpoch: 0,
    });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, healthySnapshot]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([]);
    expect(calls.sentKeys).toHaveLength(0);
  });

  it('sends handover keys when 5-hour utilization is at the exhaustion threshold', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.9 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map<string, number>();

    const result = await useCase.run(
      defaultInput({ sentHandoverTimestamps }),
    );

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toEqual([
      {
        sessionName: toTmuxSessionName(ISSUE_URL),
        text: DEFAULT_HANDOVER_MESSAGE,
      },
    ]);
    expect(sentHandoverTimestamps.get(ISSUE_URL)).toBe(NOW_EPOCH);
  });

  it('sends handover keys when 7-day utilization is at the exhaustion threshold', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ sevenDayUtilization: 0.95 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map<string, number>();

    const result = await useCase.run(
      defaultInput({ sentHandoverTimestamps }),
    );

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toHaveLength(1);
    expect(sentHandoverTimestamps.has(ISSUE_URL)).toBe(true);
  });

  it('sends handover keys when the token is blocked', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ blocked: true });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toHaveLength(1);
  });

  it('sends handover keys when the token is rejected', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ rejected: true });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toHaveLength(1);
  });

  it('sends handover keys when blockedUntilEpoch is in the future', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ blockedUntilEpoch: NOW_EPOCH + 60 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toHaveLength(1);
  });

  it('does nothing while the grace period has not yet elapsed', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map([
      [ISSUE_URL, NOW_EPOCH - DEFAULT_GRACE_PERIOD_SECONDS + 10],
    ]);

    const result = await useCase.run(
      defaultInput({ sentHandoverTimestamps }),
    );

    expect(result.handoverInitiatedIssueUrls).toEqual([]);
    expect(result.killedIssueUrls).toEqual([]);
    expect(calls.sentKeys).toHaveLength(0);
    expect(calls.killedSessions).toHaveLength(0);
  });

  it('kills the session and removes the debounce entry after the grace period elapses', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map([
      [ISSUE_URL, NOW_EPOCH - DEFAULT_GRACE_PERIOD_SECONDS],
    ]);

    const result = await useCase.run(
      defaultInput({ sentHandoverTimestamps }),
    );

    expect(result.killedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.killedSessions).toEqual([toTmuxSessionName(ISSUE_URL)]);
    expect(sentHandoverTimestamps.has(ISSUE_URL)).toBe(false);
  });

  it('does not call sendKeys in dry-run mode but still records the timestamp', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map<string, number>();

    const result = await useCase.run(
      defaultInput({ dryRun: true, sentHandoverTimestamps }),
    );

    expect(result.handoverInitiatedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.sentKeys).toHaveLength(0);
    expect(sentHandoverTimestamps.has(ISSUE_URL)).toBe(true);
  });

  it('does not call killSession in dry-run mode but still reports the kill', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );
    const sentHandoverTimestamps = new Map([
      [ISSUE_URL, NOW_EPOCH - DEFAULT_GRACE_PERIOD_SECONDS],
    ]);

    const result = await useCase.run(
      defaultInput({ dryRun: true, sentHandoverTimestamps }),
    );

    expect(result.killedIssueUrls).toEqual([ISSUE_URL]);
    expect(calls.killedSessions).toHaveLength(0);
  });

  it('handles multiple sessions independently', async () => {
    const tokenA = 'token-a';
    const tokenB = 'token-b';
    const issueUrlA = 'https://github.com/demo/repo/issues/10';
    const issueUrlB = 'https://github.com/demo/repo/issues/20';
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const exhaustedSnapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const healthySnapshot = makeSnapshot({ fiveHourUtilization: 0.3 });
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([
        makeSession({ token: tokenA, issueUrl: issueUrlA }),
        makeSession({ token: tokenB, issueUrl: issueUrlB }),
      ]),
      createFakeSnapshotRepository(
        new Map([
          [tokenA, exhaustedSnapshot],
          [tokenB, healthySnapshot],
        ]),
      ),
      createFakeTmuxRepository(calls),
    );

    const result = await useCase.run(defaultInput());

    expect(result.handoverInitiatedIssueUrls).toEqual([issueUrlA]);
    expect(calls.sentKeys).toHaveLength(1);
    expect(calls.sentKeys[0].sessionName).toBe(toTmuxSessionName(issueUrlA));
  });

  it('sends the custom handover message text to the tmux session', async () => {
    const calls: TmuxCalls = { sentKeys: [], killedSessions: [] };
    const snapshot = makeSnapshot({ fiveHourUtilization: 0.95 });
    const customMessage = 'CUSTOM_HANDOVER_MESSAGE';
    const useCase = new TokenExhaustionHandoverUseCase(
      createFakeSessionRepository([makeSession()]),
      createFakeSnapshotRepository(new Map([[TOKEN, snapshot]])),
      createFakeTmuxRepository(calls),
    );

    await useCase.run(defaultInput({ handoverMessageText: customMessage }));

    expect(calls.sentKeys[0].text).toBe(customMessage);
  });
});
