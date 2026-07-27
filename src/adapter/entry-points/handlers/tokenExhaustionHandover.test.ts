const mockUseCaseRun = jest.fn();
const mockStateLoad = jest.fn();
const mockStateSave = jest.fn();
const mockListSnapshots = jest.fn();
const mockListHandoverSessions = jest.fn();

jest.mock('../../../domain/usecases/TokenExhaustionHandoverUseCase', () => ({
  TokenExhaustionHandoverUseCase: jest.fn().mockImplementation(() => ({
    run: mockUseCaseRun,
  })),
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE: 'default-issue-url-message',
  DEFAULT_TOKEN_EXHAUSTION_HANDOVER_MESSAGE_BARE_NAME_LEADER:
    'default-bare-name-message',
  DEFAULT_TOKEN_EXHAUSTION_GRACE_PERIOD_SECONDS: 180,
}));

jest.mock('../../../adapter/repositories/RateLimitSnapshotRepository', () => ({
  RateLimitSnapshotRepository: jest.fn().mockImplementation(() => ({
    listSnapshots: mockListSnapshots,
  })),
}));

jest.mock('../../../adapter/repositories/FileHandoverStateRepository', () => ({
  FileHandoverStateRepository: jest.fn().mockImplementation(() => ({
    load: mockStateLoad,
    save: mockStateSave,
  })),
  defaultHandoverStateFilePath: () => '/default/state.json',
}));

jest.mock('../../../adapter/repositories/ProcClaudeHandoverSessionRepository', () => ({
  ProcClaudeHandoverSessionRepository: jest.fn().mockImplementation(() => ({
    listHandoverSessions: mockListHandoverSessions,
  })),
}));

jest.mock('../../../adapter/repositories/NodeTmuxSessionRepository', () => ({
  NodeTmuxSessionRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../adapter/repositories/NodeProcessSignalRepository', () => ({
  NodeProcessSignalRepository: jest.fn().mockImplementation(() => ({})),
}));

import { handleTokenExhaustionHandover } from './tokenExhaustionHandover';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';

const mockLocalCommandRunner: LocalCommandRunner = {
  runCommand: jest.fn(),
};

const now = new Date('2026-01-01T12:00:00Z');

describe('handleTokenExhaustionHandover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mockStateLoad.mockReturnValue({ entries: {} });
    mockUseCaseRun.mockResolvedValue({
      newlyHandoverSentSessionNames: [],
      killedSessionNames: [],
      terminatedPids: [],
      relaunchedLeaderNames: [],
      leftAliveSessionNames: [],
      state: { entries: {} },
    });
  });

  it('skips and logs when tokenListJsonPath is null', async () => {
    const logSpy = jest.spyOn(console, 'log');

    await handleTokenExhaustionHandover({
      enabled: true,
      tokenListJsonPath: null,
      localCommandRunner: mockLocalCommandRunner,
      now,
    });

    expect(mockUseCaseRun).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Token exhaustion handover: skipped (no claudeCodeOauthTokenListJsonPath configured).',
    );
  });

  it('runs the use case with defaults when optional params are omitted', async () => {
    await handleTokenExhaustionHandover({
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      localCommandRunner: mockLocalCommandRunner,
      now,
    });

    expect(mockUseCaseRun).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        issueUrlLeaderMessage: 'default-issue-url-message',
        bareNameLeaderMessage: 'default-bare-name-message',
        gracePeriodSeconds: 180,
        now,
      }),
    );
  });

  it('passes custom handover messages to the use case when provided', async () => {
    await handleTokenExhaustionHandover({
      enabled: false,
      tokenListJsonPath: '/tokens.json',
      handoverMessage: 'custom-issue-url-msg',
      bareNameLeaderHandoverMessage: 'custom-bare-name-msg',
      gracePeriodSeconds: 60,
      localCommandRunner: mockLocalCommandRunner,
      now,
    });

    expect(mockUseCaseRun).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        issueUrlLeaderMessage: 'custom-issue-url-msg',
        bareNameLeaderMessage: 'custom-bare-name-msg',
        gracePeriodSeconds: 60,
      }),
    );
  });

  it('saves the returned state after the use case runs', async () => {
    const returnedState = { entries: { 'session-a': { signaledAtEpoch: 1, pid: 2 } } };
    mockUseCaseRun.mockResolvedValue({
      newlyHandoverSentSessionNames: [],
      killedSessionNames: [],
      terminatedPids: [],
      relaunchedLeaderNames: [],
      leftAliveSessionNames: [],
      state: returnedState,
    });

    await handleTokenExhaustionHandover({
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      localCommandRunner: mockLocalCommandRunner,
      now,
    });

    expect(mockStateSave).toHaveBeenCalledWith(returnedState);
  });
});
