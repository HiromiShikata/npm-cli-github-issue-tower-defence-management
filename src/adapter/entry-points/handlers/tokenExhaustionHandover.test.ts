import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';

jest.mock('../../repositories/GitHubIssueCheckpointRepository', () => ({
  GitHubIssueCheckpointRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/NodeTmuxSessionRepository', () => ({
  NodeTmuxSessionRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/RateLimitSnapshotRepository', () => ({
  RateLimitSnapshotRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/ProcClaudeHandoverSessionRepository', () => ({
  ProcClaudeHandoverSessionRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../../repositories/NodeProcessSignalRepository', () => ({
  NodeProcessSignalRepository: jest.fn().mockImplementation(() => ({})),
}));

const mockLoad = jest.fn();
const mockSave = jest.fn();
jest.mock('../../repositories/FileHandoverStateRepository', () => ({
  FileHandoverStateRepository: jest.fn().mockImplementation(() => ({
    load: mockLoad,
    save: mockSave,
  })),
  defaultHandoverStateFilePath: jest
    .fn()
    .mockReturnValue('/default/state.json'),
}));

const mockRun = jest.fn();
jest.mock('../../../domain/usecases/TokenExhaustionHandoverUseCase', () => ({
  TokenExhaustionHandoverUseCase: jest.fn().mockImplementation(() => ({
    run: mockRun,
  })),
}));

import { handleTokenExhaustionHandover } from './tokenExhaustionHandover';
import { TokenExhaustionHandoverUseCase } from '../../../domain/usecases/TokenExhaustionHandoverUseCase';
import { GitHubIssueCheckpointRepository } from '../../repositories/GitHubIssueCheckpointRepository';
import { NodeTmuxSessionRepository } from '../../repositories/NodeTmuxSessionRepository';
import { RateLimitSnapshotRepository } from '../../repositories/RateLimitSnapshotRepository';
import { ProcClaudeHandoverSessionRepository } from '../../repositories/ProcClaudeHandoverSessionRepository';
import { NodeProcessSignalRepository } from '../../repositories/NodeProcessSignalRepository';
import { FileHandoverStateRepository } from '../../repositories/FileHandoverStateRepository';

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

const createMockRunner = (): Mocked<LocalCommandRunner> => ({
  runCommand: jest.fn(),
  spawnInteractive: jest.fn(),
});

describe('handleTokenExhaustionHandover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockReturnValue({ entries: {} });
    mockRun.mockResolvedValue({ state: { entries: {} } });
  });

  it('accepts handoverMessage and bareNameLeaderHandoverMessage but does not forward them to the use case run call', async () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const localCommandRunner = createMockRunner();
    const params = {
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      handoverMessage: 'custom handover message',
      bareNameLeaderHandoverMessage: 'custom bare name leader message',
      handoverActionCooldownSeconds: 999,
      localCommandRunner,
      now,
    };

    await handleTokenExhaustionHandover(params);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      enabled: true,
      state: { entries: {} },
      now,
      handoverActionCooldownSeconds: 999,
    });
  });

  it('forwards an explicit handoverActionCooldownSeconds value to the use case run call', async () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const localCommandRunner = createMockRunner();
    const params = {
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      handoverActionCooldownSeconds: 45,
      localCommandRunner,
      now,
    };

    await handleTokenExhaustionHandover(params);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      enabled: true,
      state: { entries: {} },
      now,
      handoverActionCooldownSeconds: 45,
    });
  });

  it('forwards the default cooldown constant to the use case run call when handoverActionCooldownSeconds is unset', async () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const localCommandRunner = createMockRunner();

    await handleTokenExhaustionHandover({
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      localCommandRunner,
      now,
    });

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      enabled: true,
      state: { entries: {} },
      now,
      handoverActionCooldownSeconds: 180,
    });
  });

  it('forwards the default cooldown constant to the use case run call when handoverActionCooldownSeconds is null', async () => {
    const now = new Date('2026-09-26T00:00:00.000Z');
    const localCommandRunner = createMockRunner();
    const params = {
      enabled: true,
      tokenListJsonPath: '/tokens.json',
      handoverActionCooldownSeconds: null,
      localCommandRunner,
      now,
    };

    await handleTokenExhaustionHandover(params);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith({
      enabled: true,
      state: { entries: {} },
      now,
      handoverActionCooldownSeconds: 180,
    });
  });

  it('returns early without constructing the use case or any repository when tokenListJsonPath is null', async () => {
    const localCommandRunner = createMockRunner();

    await handleTokenExhaustionHandover({
      enabled: true,
      tokenListJsonPath: null,
      localCommandRunner,
      now: new Date('2026-09-26T00:00:00.000Z'),
    });

    expect(TokenExhaustionHandoverUseCase).not.toHaveBeenCalled();
    expect(GitHubIssueCheckpointRepository).not.toHaveBeenCalled();
    expect(NodeTmuxSessionRepository).not.toHaveBeenCalled();
    expect(RateLimitSnapshotRepository).not.toHaveBeenCalled();
    expect(ProcClaudeHandoverSessionRepository).not.toHaveBeenCalled();
    expect(NodeProcessSignalRepository).not.toHaveBeenCalled();
    expect(FileHandoverStateRepository).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });
});
