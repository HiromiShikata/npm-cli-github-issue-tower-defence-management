import {
  TokenExhaustionHandoverUseCase,
  TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS,
  TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS,
} from './TokenExhaustionHandoverUseCase';
import {
  ClaudeHandoverSession,
  ClaudeHandoverSessionKind,
} from '../entities/ClaudeHandoverSession';
import { TokenExhaustionHandoverState } from '../entities/TokenExhaustionHandoverState';
import { ClaudeHandoverSessionRepository } from './adapter-interfaces/ClaudeHandoverSessionRepository';
import { IssueCheckpointRepository } from './adapter-interfaces/IssueCheckpointRepository';
import { ProcessSignalRepository } from './adapter-interfaces/ProcessSignalRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { TokenExhaustionHandoverStateRepository } from './adapter-interfaces/TokenExhaustionHandoverStateRepository';
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
    state: TokenExhaustionHandoverState;
    now: Date;
    handoverActionCooldownSeconds: number;
  }> = {},
) => ({
  enabled: true,
  issueUrlLeaderMessage: '',
  bareNameLeaderMessage: '',
  gracePeriodSeconds: 0,
  handoverActionCooldownSeconds: 180,
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
  let stateRepository: Mocked<
    Pick<TokenExhaustionHandoverStateRepository, 'save'>
  >;

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
    stateRepository = {
      save: jest.fn(),
    };

    useCase = new TokenExhaustionHandoverUseCase(
      handoverSessionRepository,
      snapshotRepository,
      tmuxSessionRepository,
      processSignalRepository,
      issueCheckpointRepository,
      stateRepository,
    );
  });

  it('does nothing when there are no sessions', async () => {
    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([]);
    expect(result.terminatedPids).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('logs a cycle summary every run using the new format with no signaled count', async () => {
    const logSpy = jest.spyOn(console, 'log');

    await useCase.run(defaultInput({ enabled: false }));

    expect(logSpy).toHaveBeenCalledWith(
      'Token exhaustion handover: cycle summary evaluated=0 enabled=false killed=0 terminatedPids=0 relaunched=0 leftAlive=0 skippedWorkspacePreparation=0',
    );
  });

  it('skips a session whose token has no snapshot', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([]);

    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
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

    expect(result.killedSessionNames).toEqual([]);
    expect(result.state.entries[ISSUE_URL_SESSION]).toBeUndefined();
  });

  it('skips a hard-stale snapshot even when the last reading was rejected', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        rejected: true,
        lastUpdatedEpoch:
          nowEpochSeconds -
          TOKEN_EXHAUSTION_SNAPSHOT_HARD_STALE_THRESHOLD_SECONDS -
          1,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('evaluates a slightly-stale snapshot normally when it is in the warning band, and kills the now-exhausted session', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        rejected: true,
        lastUpdatedEpoch:
          nowEpochSeconds -
          TOKEN_EXHAUSTION_SNAPSHOT_STALE_THRESHOLD_SECONDS -
          10,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
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

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
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

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
  });

  it('does not kill or message a tmux session whose seven-day free ratio is low but the token is not rejected or blocked (criterion 1)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, {
        sevenDayUtilization: 0.98,
        fiveHourUtilization: 0.1,
      }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('does not kill or message a tmux session whose five-hour free ratio is low but the token is not rejected or blocked (criterion 2)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { fiveHourUtilization: 0.95 }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
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

    expect(result.killedSessionNames).toEqual([]);
    expect(result.terminatedPids).toEqual([]);
    expect(processSignalRepository.terminateProcess).not.toHaveBeenCalled();
  });

  it('leaves a session alive when it is rejected and every other token is also rejected (criterion 5)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH, { rejected: true }),
    ]);

    const result = await useCase.run(defaultInput());

    expect(result.leftAliveSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(result.killedSessionNames).toEqual([]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });

  it('kills and relaunches a bare-name leader immediately in the same cycle when rejected, without sending a message (criterion 3)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    const killSessionOrder =
      tmuxSessionRepository.killSession.mock.invocationCallOrder[0];
    const killProcessOrder =
      processSignalRepository.killProcess.mock.invocationCallOrder[0];
    expect(killSessionOrder).toBeLessThan(killProcessOrder);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(BARE_NAME);
    expect(processSignalRepository.killProcess).toHaveBeenCalledWith(
      LEADER_PID,
    );
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).toHaveBeenCalledWith(BARE_NAME);
    expect(result.killedSessionNames).toEqual([BARE_NAME]);
    expect(result.relaunchedLeaderNames).toEqual([BARE_NAME]);
  });

  it('detects exhaustion via a rejected window status and kills the issue-url leader without messaging or relaunching it (criterion 4)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(
      ISSUE_URL_SESSION,
    );
    expect(processSignalRepository.killProcess).toHaveBeenCalledWith(
      LEADER_PID,
    );
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(result.relaunchedLeaderNames).toEqual([]);
  });

  it('kills and relaunches a bare-name leader immediately when a rejected weekly hard cap has a future reset (criterion 6)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    const weeklyCap: TokenModelWeeklyLimit[] = [
      { rejected: true, resetsAt: nowEpochSeconds + 3600 },
    ];
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { modelWeeklyLimits: weeklyCap }),
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
  });

  it('kills and relaunches a bare-name leader immediately when blockedUntilEpoch is in the future (criterion 6)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { blockedUntilEpoch: nowEpochSeconds + 3600 }),
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
  });

  it('kills an issue-url leader when a rejected weekly hard cap has a future reset', async () => {
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

    expect(result.killedSessionNames).toEqual([ISSUE_URL_SESSION]);
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
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

    expect(result.killedSessionNames).toEqual([]);
    expect(result.leftAliveSessionNames).toEqual([]);
  });

  it('terminates then kills an impl subagent immediately in the same cycle when rejected, without relaunching it', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      implSubagentSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

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
    expect(result.killedSessionNames).toEqual([]);
    expect(result.relaunchedLeaderNames).toEqual([]);
    expect(issueCheckpointRepository.postCheckpoint).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
  });

  it('relaunches a bare-name leader immediately even when killSession throws because the session already exited', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
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
    expect(result.state.entries[BARE_NAME]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: LEADER_PID,
    });
  });

  it('kills and relaunches a bare-name leader immediately even when a pre-existing state entry exists', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [BARE_NAME]: {
              signaledAtEpoch: nowEpochSeconds - 100000,
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
    expect(result.state.entries[BARE_NAME]).toEqual({
      signaledAtEpoch: nowEpochSeconds,
      pid: LEADER_PID,
    });
  });

  it('leaves a session launched by the workspace preparation script untouched instead of terminating it', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      workspacePreparationSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);

    const result = await useCase.run(defaultInput());

    expect(processSignalRepository.terminateProcess).not.toHaveBeenCalled();
    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([]);
    expect(result.terminatedPids).toEqual([]);
    expect(result.skippedWorkspacePreparationSessionNames).toEqual([
      `pid:${IMPL_PID}`,
    ]);
    expect(result.state.entries).toEqual({});
  });

  it('does not force-kill a workspace preparation session even when a pre-existing state entry exists', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      workspacePreparationSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);
    processSignalRepository.isProcessAlive.mockReturnValue(true);

    const result = await useCase.run(
      defaultInput({
        state: {
          entries: {
            [`pid:${IMPL_PID}`]: {
              signaledAtEpoch: nowEpochSeconds - 100000,
              pid: IMPL_PID,
            },
          },
        },
      }),
    );

    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.terminatedPids).toEqual([]);
    expect(result.state.entries).toEqual({});
  });

  it('logs the would-be kill for an issue-url leader without messaging or killing it when enabled is false', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      issueUrlLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);
    const logSpy = jest.spyOn(console, 'log');

    const result = await useCase.run(defaultInput({ enabled: false }));

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(ISSUE_URL_SESSION),
    );
  });

  it('with enabled false, kills nothing for the rejected bare-name leader and only logs the would-be action (criterion 7)', async () => {
    handoverSessionRepository.listHandoverSessions.mockReturnValue([
      bareNameLeaderSession(),
    ]);
    snapshotRepository.listSnapshots.mockReturnValue([
      snapshot(TOKEN_EXHAUSTED, { rejected: true }),
      snapshot(TOKEN_FRESH),
    ]);
    const logSpy = jest.spyOn(console, 'log');

    const result = await useCase.run(defaultInput({ enabled: false }));

    expect(tmuxSessionRepository.sendKeys).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(
      tmuxSessionRepository.launchBareNameLeaderSession,
    ).not.toHaveBeenCalled();
    expect(processSignalRepository.killProcess).not.toHaveBeenCalled();
    expect(result.killedSessionNames).toEqual([]);
    expect(result.relaunchedLeaderNames).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(BARE_NAME));
  });

  describe('handoverActionCooldownSeconds gating', () => {
    const STATE_KEY_FOR_KIND: Record<ClaudeHandoverSessionKind, string> = {
      bareNameLeader: BARE_NAME,
      issueUrlLeader: ISSUE_URL_SESSION,
      implSubagent: `pid:${IMPL_PID}`,
    };
    const PID_FOR_KIND: Record<ClaudeHandoverSessionKind, number> = {
      bareNameLeader: LEADER_PID,
      issueUrlLeader: LEADER_PID,
      implSubagent: IMPL_PID,
    };

    type CooldownGatingCase = {
      description: string;
      sessionFactory: () => ClaudeHandoverSession;
      existingEntryElapsedSeconds: number | null;
      handoverActionCooldownSeconds: number;
      enabled: boolean;
      exhausted: boolean;
      expectedKilledSessionNames: string[];
      expectedTerminatedPids: number[];
      expectedRelaunchedLeaderNames: string[];
      expectedStateEntry: 'now' | 'unchanged' | 'absent';
    };

    const cases: CooldownGatingCase[] = [
      {
        description:
          '#1 bareNameLeader, no existing entry, cooldown=180, enabled=true -> kill+relaunch',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: null,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [BARE_NAME],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [BARE_NAME],
        expectedStateEntry: 'now',
      },
      {
        description:
          '#2 bareNameLeader, entry 30s old, cooldown=180, enabled=true -> skip (cooling down)',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: 30,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'unchanged',
      },
      {
        description:
          '#3 bareNameLeader, entry exactly 180s old (boundary), cooldown=180, enabled=true -> kill+relaunch again',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: 180,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [BARE_NAME],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [BARE_NAME],
        expectedStateEntry: 'now',
      },
      {
        description:
          '#4 issueUrlLeader, no existing entry, cooldown=180, enabled=true -> kill only, no relaunch',
        sessionFactory: issueUrlLeaderSession,
        existingEntryElapsedSeconds: null,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [ISSUE_URL_SESSION],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'now',
      },
      {
        description:
          '#5 issueUrlLeader, entry 30s old, cooldown=180, enabled=true -> skip',
        sessionFactory: issueUrlLeaderSession,
        existingEntryElapsedSeconds: 30,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'unchanged',
      },
      {
        description:
          '#6 implSubagent, no existing entry, cooldown=180, enabled=true -> SIGTERM+kill',
        sessionFactory: implSubagentSession,
        existingEntryElapsedSeconds: null,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [IMPL_PID],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'now',
      },
      {
        description:
          '#7 bareNameLeader, entry 30s old, cooldown=180, enabled=false (dry-run) -> log would-kill only, entry preserved',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: 30,
        handoverActionCooldownSeconds: 180,
        enabled: false,
        exhausted: true,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'unchanged',
      },
      {
        description:
          '#8 bareNameLeader, no existing entry, cooldown=180, enabled=false (dry-run) -> log would-kill only, stays absent',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: null,
        handoverActionCooldownSeconds: 180,
        enabled: false,
        exhausted: true,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'absent',
      },
      {
        description:
          '#9 bareNameLeader, entry 30s old, cooldown=0 (operator opt-out), enabled=true -> kill+relaunch (cooldown disabled)',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: 30,
        handoverActionCooldownSeconds: 0,
        enabled: true,
        exhausted: true,
        expectedKilledSessionNames: [BARE_NAME],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [BARE_NAME],
        expectedStateEntry: 'now',
      },
      {
        description:
          '#10 bareNameLeader, entry 30s old (within cooldown), cooldown=180, enabled=true, verdict turns healthy -> entry deleted regardless of cooldown',
        sessionFactory: bareNameLeaderSession,
        existingEntryElapsedSeconds: 30,
        handoverActionCooldownSeconds: 180,
        enabled: true,
        exhausted: false,
        expectedKilledSessionNames: [],
        expectedTerminatedPids: [],
        expectedRelaunchedLeaderNames: [],
        expectedStateEntry: 'absent',
      },
    ];

    it.each(cases)(
      '$description',
      async ({
        sessionFactory,
        existingEntryElapsedSeconds,
        handoverActionCooldownSeconds,
        enabled,
        exhausted,
        expectedKilledSessionNames,
        expectedTerminatedPids,
        expectedRelaunchedLeaderNames,
        expectedStateEntry,
      }) => {
        const session = sessionFactory();
        const stateKey = STATE_KEY_FOR_KIND[session.kind];
        const pid = PID_FOR_KIND[session.kind];
        handoverSessionRepository.listHandoverSessions.mockReturnValue([
          session,
        ]);
        snapshotRepository.listSnapshots.mockReturnValue([
          snapshot(TOKEN_EXHAUSTED, exhausted ? { rejected: true } : {}),
          snapshot(TOKEN_FRESH),
        ]);
        const existingEntry =
          existingEntryElapsedSeconds === null
            ? undefined
            : {
                signaledAtEpoch: nowEpochSeconds - existingEntryElapsedSeconds,
                pid,
              };

        const result = await useCase.run(
          defaultInput({
            enabled,
            handoverActionCooldownSeconds,
            state: {
              entries:
                existingEntry === undefined
                  ? {}
                  : { [stateKey]: existingEntry },
            },
          }),
        );

        expect(result.killedSessionNames).toEqual(expectedKilledSessionNames);
        expect(result.terminatedPids).toEqual(expectedTerminatedPids);
        expect(result.relaunchedLeaderNames).toEqual(
          expectedRelaunchedLeaderNames,
        );

        if (expectedStateEntry === 'now') {
          expect(result.state.entries[stateKey]).toEqual({
            signaledAtEpoch: nowEpochSeconds,
            pid,
          });
        } else if (expectedStateEntry === 'unchanged') {
          expect(result.state.entries[stateKey]).toEqual(existingEntry);
        } else {
          expect(result.state.entries[stateKey]).toBeUndefined();
        }
      },
    );
  });

  describe('per-session state persistence (issue #2878)', () => {
    it('saves the handover state through the injected repository after each session is processed, not only once after the whole run resolves', async () => {
      const sessionA: ClaudeHandoverSession = {
        ...issueUrlLeaderSession(),
        pid: 2001,
        sessionName: 'session-a',
        name: 'session-a',
        issueUrl: 'https://github.com/owner/repo/issues/2',
      };
      const sessionB: ClaudeHandoverSession = {
        ...issueUrlLeaderSession(),
        pid: 2002,
        sessionName: 'session-b',
        name: 'session-b',
        issueUrl: 'https://github.com/owner/repo/issues/3',
      };
      handoverSessionRepository.listHandoverSessions.mockReturnValue([
        sessionA,
        sessionB,
      ]);
      snapshotRepository.listSnapshots.mockReturnValue([
        snapshot(TOKEN_EXHAUSTED, { rejected: true }),
        snapshot(TOKEN_FRESH),
      ]);

      await useCase.run(defaultInput());

      expect(stateRepository.save).toHaveBeenCalledTimes(2);
      expect(stateRepository.save).toHaveBeenNthCalledWith(1, {
        entries: {
          'session-a': { signaledAtEpoch: nowEpochSeconds, pid: 2001 },
        },
      });
      expect(stateRepository.save).toHaveBeenNthCalledWith(2, {
        entries: {
          'session-a': { signaledAtEpoch: nowEpochSeconds, pid: 2001 },
          'session-b': { signaledAtEpoch: nowEpochSeconds, pid: 2002 },
        },
      });
    });
  });
});
