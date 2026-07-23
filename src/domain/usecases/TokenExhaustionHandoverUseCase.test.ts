import {
  TokenExhaustionHandoverUseCase,
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
  DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
  TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS,
} from './TokenExhaustionHandoverUseCase';
import { ClaudeInteractiveSessionRepository } from './adapter-interfaces/ClaudeInteractiveSessionRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { TokenRateLimitSnapshotRepository } from './adapter-interfaces/TokenRateLimitSnapshotRepository';
import { toTmuxSessionName } from './intmux/InTmuxByHumanSessionReconcileUseCase';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const TOKEN_A = 'token-a';
const TOKEN_B = 'token-b';
const ISSUE_URL_1 = 'https://github.com/owner/repo/issues/1';
const ISSUE_URL_2 = 'https://github.com/owner/repo/issues/2';
const SESSION_1 = toTmuxSessionName(ISSUE_URL_1);
const SESSION_2 = toTmuxSessionName(ISSUE_URL_2);

const now = new Date('2026-01-01T12:00:00Z');
const nowEpochSeconds = Math.floor(now.getTime() / 1000);

const freshSnapshot = (
  token: string,
  overrides: Partial<{
    fiveHourUtilization: number;
    sevenDayUtilization: number;
    blocked: boolean;
    rejected: boolean;
    blockedUntilEpoch: number;
    lastUpdatedEpoch: number;
  }> = {},
) => ({
  token,
  name: `name-${token}`,
  fiveHourUtilization: 0,
  sevenDayUtilization: 0,
  blocked: false,
  rejected: false,
  blockedUntilEpoch: 0,
  lastUpdatedEpoch: nowEpochSeconds - 60,
  ...overrides,
});

const defaultRunInput = (
  overrides: Partial<{
    enabled: boolean;
    handoverMessage: string;
    gracePeriodSeconds: number;
    handoverSentAtEpochBySessionName: ReadonlyMap<string, number>;
    now: Date;
  }> = {},
) => ({
  enabled: true,
  handoverMessage: DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
  gracePeriodSeconds: DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
  handoverSentAtEpochBySessionName: new Map<string, number>(),
  now,
  ...overrides,
});

describe('TokenExhaustionHandoverUseCase', () => {
  let useCase: TokenExhaustionHandoverUseCase;
  let mockInteractiveSessionRepository: Mocked<
    Pick<ClaudeInteractiveSessionRepository, 'listInteractiveSessions'>
  >;
  let mockSnapshotRepository: Mocked<
    Pick<TokenRateLimitSnapshotRepository, 'listSnapshots'>
  >;
  let mockTmuxSessionRepository: Mocked<
    Pick<TmuxSessionRepository, 'sendKeys' | 'killSession'>
  >;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    mockInteractiveSessionRepository = {
      listInteractiveSessions: jest.fn().mockReturnValue([]),
    };
    mockSnapshotRepository = {
      listSnapshots: jest.fn().mockReturnValue([]),
    };
    mockTmuxSessionRepository = {
      sendKeys: jest.fn().mockResolvedValue(undefined),
      killSession: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new TokenExhaustionHandoverUseCase(
      mockInteractiveSessionRepository,
      mockSnapshotRepository,
      mockTmuxSessionRepository,
    );
  });

  it('exposes default constants', () => {
    expect(DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE).toBeTruthy();
    expect(DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS).toBe(180);
    expect(TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS).toBe(900);
  });

  it('sends handover to a session whose token fiveHourUtilization meets the exhaustion threshold', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { fiveHourUtilization: 0.9 }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(result.newlyHandoverSentSessionNames).toEqual([SESSION_1]);
    expect(result.killedSessionNames).toEqual([]);
  });

  it('sends handover to a session whose token sevenDayUtilization meets the exhaustion threshold', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { sevenDayUtilization: 0.95 }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(result.newlyHandoverSentSessionNames).toEqual([SESSION_1]);
  });

  it('sends handover to a session whose token is blocked', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
    ]);

    await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
  });

  it('sends handover to a session whose token is rejected', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { rejected: true }),
    ]);

    await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
  });

  it('sends handover to a session whose token has a blockedUntilEpoch in the future', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blockedUntilEpoch: nowEpochSeconds + 60 }),
    ]);

    await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
  });

  it('does not send handover when token snapshot is stale', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, {
        fiveHourUtilization: 0.9,
        lastUpdatedEpoch:
          nowEpochSeconds - TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS,
      }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('does not send handover when no exhaustion criteria are met', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, {
        fiveHourUtilization: 0.89,
        sevenDayUtilization: 0.94,
      }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('does not send handover when session is within the grace period', async () => {
    const handoverSentAt =
      nowEpochSeconds - DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS + 10;
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { fiveHourUtilization: 0.9 }),
    ]);

    const result = await useCase.run(
      defaultRunInput({
        handoverSentAtEpochBySessionName: new Map([
          [SESSION_1, handoverSentAt],
        ]),
      }),
    );

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.killedSessionNames).toEqual([]);
  });

  it('kills a session after the grace period elapses', async () => {
    const handoverSentAt =
      nowEpochSeconds - DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS;
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { fiveHourUtilization: 0.9 }),
    ]);

    const result = await useCase.run(
      defaultRunInput({
        handoverSentAtEpochBySessionName: new Map([
          [SESSION_1, handoverSentAt],
        ]),
      }),
    );

    expect(mockTmuxSessionRepository.killSession).toHaveBeenCalledWith(
      SESSION_1,
    );
    expect(result.killedSessionNames).toEqual([SESSION_1]);
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('does not call sendKeys when enabled is false', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { fiveHourUtilization: 0.9 }),
    ]);

    const result = await useCase.run(defaultRunInput({ enabled: false }));

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([SESSION_1]);
  });

  it('does not call killSession when enabled is false', async () => {
    const handoverSentAt =
      nowEpochSeconds - DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS;
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { fiveHourUtilization: 0.9 }),
    ]);

    const result = await useCase.run(
      defaultRunInput({
        enabled: false,
        handoverSentAtEpochBySessionName: new Map([
          [SESSION_1, handoverSentAt],
        ]),
      }),
    );

    expect(mockTmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([SESSION_1]);
  });

  it('sends handover to all sessions using exhausted tokens across multiple sessions', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
      { token: TOKEN_A, sessionId: 'sid-2', issueUrl: ISSUE_URL_2 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledTimes(2);
    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_2,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(result.newlyHandoverSentSessionNames).toEqual([
      SESSION_1,
      SESSION_2,
    ]);
  });

  it('ignores sessions whose token is not exhausted', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
      { token: TOKEN_B, sessionId: 'sid-2', issueUrl: ISSUE_URL_2 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
      freshSnapshot(TOKEN_B),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledTimes(1);
    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(result.newlyHandoverSentSessionNames).toEqual([SESSION_1]);
  });

  it('ignores sessions whose token has no snapshot in the repository', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('derives the tmux session name from the issue URL using the dot-and-colon convention', async () => {
    const issueUrl = 'https://github.com/owner/repo/issues/42';
    const expectedSessionName = 'https_//github_com/owner/repo/issues/42';
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-42', issueUrl },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
    ]);

    await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      expectedSessionName,
      expect.any(String),
    );
  });

  it('returns empty results when no sessions are running', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue(
      [],
    );
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.killedSessionNames).toEqual([]);
  });

  it('uses a custom handover message when provided', async () => {
    const customMessage = 'Custom handover message for testing';
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blocked: true }),
    ]);

    await useCase.run(defaultRunInput({ handoverMessage: customMessage }));

    expect(mockTmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      SESSION_1,
      customMessage,
    );
  });

  it('handles a blockedUntilEpoch exactly equal to now as not exhausted', async () => {
    mockInteractiveSessionRepository.listInteractiveSessions.mockReturnValue([
      { token: TOKEN_A, sessionId: 'sid-1', issueUrl: ISSUE_URL_1 },
    ]);
    mockSnapshotRepository.listSnapshots.mockReturnValue([
      freshSnapshot(TOKEN_A, { blockedUntilEpoch: nowEpochSeconds }),
    ]);

    const result = await useCase.run(defaultRunInput());

    expect(mockTmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });
});
