import {
  TokenExhaustionHandoverUseCase,
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER,
  DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
  TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS,
  TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS,
} from './TokenExhaustionHandoverUseCase';
import { ClaudeHandoverSession } from '../entities/ClaudeHandoverSession';
import { TokenExhaustionHandoverState } from '../entities/TokenExhaustionHandoverState';
import { ClaudeHandoverSessionRepository } from './adapter-interfaces/ClaudeHandoverSessionRepository';
import { IssueCheckpointRepository } from './adapter-interfaces/IssueCheckpointRepository';
import { ProcessSignalRepository } from './adapter-interfaces/ProcessSignalRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import {
  TokenModelWeeklyLimit,
  TokenRateLimitSnapshot,
  TokenRateLimitSnapshotRepository,
} from './adapter-interfaces/TokenRateLimitSnapshotRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const TOKEN_EXHAUSTED = 'token-exhausted';
const TOKEN_FRESH = 'token-fresh';
const ISSUE_URL = 'https://github.com/owner/repo/issues/1';
const ISSUE_URL_SESSION = ISSUE_URL.replace(/[.:]/g, '_');
const BARE_NAME = 'app';
const IMPL_PID = 4242;
const LEADER_PID = 1111;

const now = new Date('2026-01-01T12:00:00Z');
const nowEpochSeconds = Math.floor(now.getTime() / 1000);

const snapshot = (
  token: string,
  overrides: Partial<TokenRateLimitSnapshot> = {},
): TokenRateLimitSnapshot => ({
  token,
  name: `name-${token}`,
  fiveHourUtilization: 0,
  fiveHourReset: 0,
  sevenDayUtilization: 0,
  sevenDayReset: 0,
  blocked: false,
  rejected: false,
  blockedUntilEpoch: 0,
  modelWeeklyLimits: [],
  lastUpdatedEpoch: nowEpochSeconds - 60,
  ...overrides,
});

const issueUrlLeaderSession = (): ClaudeHandoverSession => ({
  kind: 'issueUrlLeader',
  pid: LEADER_PID,
  token: TOKEN_EXHAUSTED,
  sessionName: ISSUE_URL_SESSION,
  name: ISSUE_URL,
  issueUrl: ISSUE_URL,
  runsUnderWorkspacePreparationScript: false,
});

const bareNameLeaderSession = (): ClaudeHandoverSession => ({
  kind: 'bareNameLeader',
  pid: LEADER_PID,
  token: TOKEN_EXHAUSTED,
  sessionName: BARE_NAME,
  name: BARE_NAME,
  issueUrl: null,
  runsUnderWorkspacePreparationScript: false,
});

const implSubagentSession = (): ClaudeHandoverSession => ({
  kind: 'implSubagent',
  pid: IMPL_PID,
  token: TOKEN_EXHAUSTED,
  sessionName: null,
  name: null,
  issueUrl: ISSUE_URL,
  runsUnderWorkspacePreparationScript: false,
});

const workspacePreparationSession = (): ClaudeHandoverSession => ({
  ...implSubagentSession(),
  runsUnderWorkspacePreparationScript: true,
});

const defaultInput = (
  overrides: Partial<{
    enabled: boolean;
    issueUrlLeaderMessage: string;
    bareNameLeaderMessage: string;
    gracePeriodSeconds: number;
    state: TokenExhaustionHandoverState;
    now: Date;
  }> = {},
) => ({
  enabled: true,
  issueUrlLeaderMessage: DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
  bareNameLeaderMessage:
    DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER,
  gracePeriodSeconds: DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS,
  state: { entries: {} },
  now,
  ...overrides,
});

describe('TokenExhaustionHandoverUseCase', () => {
  let useCase: TokenExhaustionHandoverUseCase;
  let handoverSessionRepository: Mocked<
    Pick<ClaudeHandoverSessionRepository, 'listHandoverSessions'>
  >;
  let snapshotRepository: Mocked<
    Pick<TokenRateLimitSnapshotRepository, 'listSnapshots'>
  >;
  let tmuxSessionRepository: Mocked<
    Pick<
      TmuxSessionRepository,
      | 'sendKeys'
      | 'killSession'
      | 'listLiveSessionNames'
      | 'launchBareNameLeaderSession'
    >
  >;
  let processSignalRepository: Mocked<ProcessSignalRepository>;
  let issueCheckpointRepository: Mocked<
    Pick<IssueCheckpointRepository, 'postCheckpoint'>
  >;

  const exhaustedFiveHour = (): TokenModelWeeklyLimit[] => [];

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    handoverSessionRepository = {
      listHandoverSessions: jest.fn().mockReturnValue([]),
    };
    snapshotRepository = {
      listSnapshots: jest.fn().mockReturnValue([]),
    };
    tmuxSessionRepository = {
      sendKeys: jest.fn().mockResolvedValue(undefined),
      killSession: jest.fn().mockResolvedValue(undefined),
      listLiveSessionNames: jest.fn().mockResolvedValue([]),
      launchBareNameLeaderSession: jest.fn().mockResolvedValue(undefined),
    };
    processSignalRepository = {
      isProcessAlive: jest.fn().mockReturnValue(true),
      terminateProcess: jest.fn(),
      killProcess: jest.fn(),
    };
    issueCheckpointRepository = {
      postCheckpoint: jest.fn().mockResolvedValue(undefined),
    };

    useCase = new TokenExhaustionHandoverUseCase(
      handoverSessionRepository,
      snapshotRepository,
      tmuxSessionRepository,
      processSignalRepository,
      issueCheckpointRepository,
    );
  });

  it('does nothing when there are no sessions', async () => {
    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.killedSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('logs a cycle summary every run so the dry-run step is observable', async () => {
    const logSpy = jest.spyOn(console, 'log');

    await useCase.run(defaultInput({ enabled: false }));

    expect(logSpy).toHaveBeenCalledWith(
      'Token exhaustion handover: cycle summary evaluated=0 enabled=false signaled=0 killed=0 terminatedPids=0 relaunched=0 leftAlive=0 skippedWorkspacePreparation=0',
    );
  });

  it('skips a session whose token has no snapshot', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('skips a non-exhausted session and clears any stale state entry', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [ISSUE_URL_SESSION]: {
              signaledAtEpoch: nowEpochSeconds,
              pid: LEADER_PID,
            },
          },
        },
      }),
    );

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.state.entries[ISSUE_URL_SESSION]).toBeUndefined();
  });

  it('skips a hard-stale snapshot even when the last reading was exhausted', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        fiveHourUtilization: 0.99,
        lastUpdatedEpoch:
          nowEpochSeconds -
          TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS -
          1,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('acts on a slightly-stale snapshot when the last reading was near exhaustion', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        fiveHourUtilization: 0.99,
        lastUpdatedEpoch:
          nowEpochSeconds -
          TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS -
          10,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(tmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      ISSUE_URL_SESSION,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
  });

  it('skips a slightly-stale snapshot when the last reading was healthy', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        fiveHourUtilization: 0,
        lastUpdatedEpoch:
          nowEpochSeconds -
          TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS -
          10,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('leaves an exhausted session alive when no fresher token is available', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.99 }),
      snapshot(TOKEN_FRESH, { fiveHourUtilization: 0.99 }),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.leftAliveSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('sends the issue-URL leader checkpoint message on first detection', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(tmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      ISSUE_URL_SESSION,
      DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE,
    );
    expect(result.state.entries[ISSUE_URL_SESSION]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: LEADER_PID,
    });
  });

  it('kills and relaunches a bare-name leader immediately on first detection without sending a message', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(BARE_NAME);
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).toHaveBeenCalledWith(BARE_NAME);
    expect(result.killedSessionNames).toEqual([BARE_NAME]);
    expect(result.relaunchedLeaderNames).toEqual([BARE_NAME]);
    expect(result.state.entries[BARE_NAME]).toBeUndefined();
  });

  it('posts a checkpoint comment to the task issue on first detection of an impl subagent with a known issue URL', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(issueCheckpointRepository.postCheckpoint).toHaveBeenCalledWith(
      ISSUE_URL,
    );
    expect(processSignalRepository.terminateProcess).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.state.entries[`pid:${IMPL_PID}`]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: IMPL_PID,
    });
  });

  it('sends SIGTERM immediately when the impl subagent has no issue URL', async () => {
    const noUrlSession: ClaudeHandoverSession = {
      ...implSubagentSession(),
      issueUrl: null,
    };
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      noUrlSession,
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    const logSpy = jest.spyOn(console, 'log');

    const result = await useCase.run(defaultInput());

    expect(processSignalRepository.terminateProcess).toHaveBeenCalledWith(
      IMPL_PID,
    );
    expect(issueCheckpointRepository.postCheckpoint).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('no issue URL'),
    );
    expect(result.state.entries[`pid:${IMPL_PID}`]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: IMPL_PID,
    });
  });

  it('does not create a state entry when postCheckpoint throws, so the next cycle retries', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    issueCheckpointRepository.postCheckpoint.mockRejectedValue(
      new Error('network error'),
    );

    const result = await useCase.run(defaultInput());

    expect(result.state.entries[`pid:${IMPL_PID}`]).toBeUndefined();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('creates a state entry after postCheckpoint succeeds', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(issueCheckpointRepository.postCheckpoint).toHaveBeenCalledWith(
      ISSUE_URL,
    );
    expect(result.state.entries[`pid:${IMPL_PID}`]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: IMPL_PID,
    });
  });

  it('leaves a session launched by the workspace preparation script untouched instead of terminating it', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      workspacePreparationSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(processSignalRepository.terminateProcess).not.toHaveBeenCalled();
    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.skippedWorkspacePreparationSessionNames).toEqual([
      `pid:${IMPL_PID}`,
    ]);
    expect(result.state.entries).toEqual({});
  });

  it('does not force-kill a workspace preparation session whose grace period has elapsed', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      workspacePreparationSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    processSignalRepository.isProcessAlive.mockReturnValue(true);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [`pid:${IMPL_PID}`]: {
              signaledAtEpoch:
                nowEpochSeconds -
                DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS -
                1,
              pid: IMPL_PID,
            },
          },
        },
      }),
    );

    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.terminatedPids).toEqual([]);
  });

  it('does not treat an impl subagent as exhausted on seven-day utilization alone', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        fiveHourUtilization: 0,
        sevenDayUtilization: 0.99,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(processSignalRepository.terminateProcess).not.toHaveBeenCalled();
  });

  it('waits while the grace period has not elapsed', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [ISSUE_URL_SESSION]: {
              signaledAtEpoch: nowEpochSeconds - 10,
              pid: LEADER_PID,
            },
          },
        },
      }),
    );

    expect(result.killedSessionNames).toEqual([]);
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(result.state.entries[ISSUE_URL_SESSION]).toEqual({
      signaledAtEpoch: nowEpochSeconds - 10,
      pid: LEADER_PID,
    });
  });

  it('kills an issue-URL leader after the grace period without relaunching it', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    tmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      ISSUE_URL_SESSION,
    ]);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [ISSUE_URL_SESSION]: {
              signaledAtEpoch:
                nowEpochSeconds -
                DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS -
                1,
              pid: LEADER_PID,
            },
          },
        },
      }),
    );

    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(
      ISSUE_URL_SESSION,
    );
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(result.state.entries[ISSUE_URL_SESSION]).toBeUndefined();
  });

  it('kills and relaunches a bare-name leader immediately even when a stale state entry exists', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [BARE_NAME]: {
              signaledAtEpoch:
                nowEpochSeconds -
                DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS -
                1,
              pid: LEADER_PID,
            },
          },
        },
      }),
    );

    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(BARE_NAME);
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).toHaveBeenCalledWith(BARE_NAME);
    expect(result.relaunchedLeaderNames).toEqual([BARE_NAME]);
    expect(result.killedSessionNames).toEqual([BARE_NAME]);
    expect(result.state.entries[BARE_NAME]).toBeUndefined();
  });

  it('SIGTERMs then SIGKILLs an impl subagent that is still alive after the grace period', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    processSignalRepository.isProcessAlive.mockReturnValue(true);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [`pid:${IMPL_PID}`]: {
              signaledAtEpoch:
                nowEpochSeconds -
                DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS -
                1,
              pid: IMPL_PID,
            },
          },
        },
      }),
    );

    const terminateOrder =
      processSignalRepository.terminateProcess.mock.invocationCallOrder[0];
    const killOrder =
      processSignalRepository.killProcess.mock.invocationCallOrder[0];
    expect(terminateOrder).toBeLessThan(killOrder);
    expect(processSignalRepository.terminateProcess).toHaveBeenCalledWith(
      IMPL_PID,
    );
    expect(processSignalRepository.killProcess).toHaveBeenCalledWith(IMPL_PID);
    expect(result.terminatedPids).toEqual([IMPL_PID]);
  });

  it('relaunches a bare-name leader immediately even when killSession throws because the session already exited', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    tmuxSessionRepository.killSession.mockRejectedValue(
      new Error('no session with name app'),
    );

    const result = await useCase.run(defaultInput());

    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).toHaveBeenCalledWith(BARE_NAME);
    expect(result.relaunchedLeaderNames).toEqual([BARE_NAME]);
    expect(result.state.entries[BARE_NAME]).toBeUndefined();
  });

  it('treats a rejected weekly hard cap with a future reset as exhausted', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    const weeklyCap: TokenModelWeeklyLimit[] = [
      { rejected: true, resetsAt: nowEpochSeconds + 3600 },
    ];
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { modelWeeklyLimits: weeklyCap }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([ISSUE_URL_SESSION]);
  });

  it('ignores a rejected weekly hard cap whose reset is already in the past', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    const weeklyCap: TokenModelWeeklyLimit[] = [
      { rejected: true, resetsAt: nowEpochSeconds - 3600 },
    ];
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { modelWeeklyLimits: weeklyCap }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });

  it('performs no side effects in dry-run mode but still records grace state', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput({ enabled: false }));

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(result.newlyHandoverSentSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(result.state.entries[ISSUE_URL_SESSION]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: LEADER_PID,
    });
  });

  it('does not kill or relaunch a bare-name leader in dry-run mode', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput({ enabled: false }));

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([]);
    expect(result.relaunchedLeaderNames).toEqual([]);
  });

  it('does not kill or claim a kill in dry-run mode after the grace period elapses', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    tmuxSessionRepository.listLiveSessionNames.mockResolvedValue([
      ISSUE_URL_SESSION,
    ]);

    const result = await useCase.run(
      defaultInput({
        enabled: false,
        state: {
          entries: {
            [ISSUE_URL_SESSION]: {
              signaledAtEpoch:
                nowEpochSeconds -
                DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS -
                1,
              pid: LEADER_PID,
            },
          },
        },
      }),
    );

    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([]);
    expect(result.terminatedPids).toEqual([]);
  });

  it('kills and relaunches bare-name leader immediately when issue-url leader message send fails', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);
    tmuxSessionRepository.sendKeys.mockImplementation(
      async (sessionName: string) => {
        if (sessionName === ISSUE_URL_SESSION) {
          throw new Error('send-keys failed');
        }
      },
    );

    const result = await useCase.run(defaultInput());

    expect(result.state.entries[ISSUE_URL_SESSION]).toBeUndefined();
    expect(result.state.entries[BARE_NAME]).toBeUndefined();
    expect(result.newlyHandoverSentSessionNames).toEqual([]);
    expect(result.killedSessionNames).toEqual([BARE_NAME]);
    expect(result.relaunchedLeaderNames).toEqual([BARE_NAME]);
  });

  it('uses a custom issue-URL leader message when provided', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    await useCase.run(
      defaultInput({ issueUrlLeaderMessage: 'custom checkpoint now' }),
    );

    expect(tmuxSessionRepository.sendKeys).toHaveBeenCalledWith(
      ISSUE_URL_SESSION,
      'custom checkpoint now',
    );
  });

  it('detects exhaustion via a rejected window status', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        rejected: true,
        modelWeeklyLimits: exhaustedFiveHour(),
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([ISSUE_URL_SESSION]);
  });

  it('treats the five-hour window as free after its reset epoch has passed', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        fiveHourUtilization: 1,
        fiveHourReset: nowEpochSeconds - 1,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.newlyHandoverSentSessionNames).toEqual([]);
  });
});
