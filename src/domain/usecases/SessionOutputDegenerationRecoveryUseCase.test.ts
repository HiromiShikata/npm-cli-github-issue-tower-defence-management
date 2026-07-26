import { SessionOutputDegenerationRecoveryUseCase } from './SessionOutputDegenerationRecoveryUseCase';
import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { SessionAssistantTurnsRepository } from './adapter-interfaces/SessionAssistantTurnsRepository';
import { SessionDegenerationCooldownStateRepository } from './adapter-interfaces/SessionDegenerationCooldownStateRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { LiveSessionProcessSnapshot } from '../entities/LiveSessionProcessSnapshot';

const SESSION_NAME = 'https://github.com/HiromiShikata/secretary/issues/2824';

const buildSnapshot = (sessionName: string): LiveSessionProcessSnapshot => ({
  sessions: [{ sessionName, panePids: [100] }],
  processes: [
    {
      pid: 100,
      ppid: 1,
      commandLine: 'claude --resume',
      sessionId: 'session-1',
      currentSessionId: 'session-1',
      configDir: '/home/user/.claude',
    },
  ],
});

const repeat = (token: string, count: number): string =>
  Array.from({ length: count }, () => token).join(' ');

type Mocked<T> = jest.Mocked<T> & jest.MockedObject<T>;

describe('SessionOutputDegenerationRecoveryUseCase', () => {
  let snapshotProvider: Mocked<LiveSessionProcessSnapshotProvider>;
  let transcriptResolver: Mocked<InteractiveLiveSessionTranscriptResolver>;
  let assistantTurnsRepository: Mocked<SessionAssistantTurnsRepository>;
  let notificationRepository: Mocked<SilentSessionNotificationRepository>;
  let tmuxSessionRepository: Mocked<Pick<TmuxSessionRepository, 'killSession'>>;
  let cooldownStateRepository: Mocked<SessionDegenerationCooldownStateRepository>;
  let sleeper: Mocked<Sleeper>;
  let useCase: SessionOutputDegenerationRecoveryUseCase;

  const now = new Date('2026-07-26T00:00:00Z');
  const nowEpochSeconds = Math.floor(now.getTime() / 1000);

  const runWith = (params: {
    enabled: boolean;
    turns: string[];
    lastResetEpochSeconds?: number;
  }): Promise<void> => {
    snapshotProvider.getSnapshot.mockResolvedValue(buildSnapshot(SESSION_NAME));
    transcriptResolver.resolveTranscriptPaths.mockReturnValue(
      new Map([[SESSION_NAME, '/fake/transcript.jsonl']]),
    );
    assistantTurnsRepository.listRecentAssistantTurnsBySessionName.mockResolvedValue(
      new Map([[SESSION_NAME, params.turns]]),
    );
    cooldownStateRepository.loadLastResetEpochSecondsBySessionName.mockResolvedValue(
      params.lastResetEpochSeconds === undefined
        ? new Map()
        : new Map([[SESSION_NAME, params.lastResetEpochSeconds]]),
    );
    return useCase.run({
      enabled: params.enabled,
      warningMessage: 'WARNING',
      graceSeconds: 5,
      cooldownSeconds: 300,
      now,
    });
  };

  beforeEach(() => {
    snapshotProvider = {
      getSnapshot: jest.fn(),
    };
    transcriptResolver = {
      resolveTranscriptPaths: jest.fn(),
    };
    assistantTurnsRepository = {
      listRecentAssistantTurnsBySessionName: jest.fn(),
    };
    notificationRepository = {
      sendSelfCheckNotification: jest.fn().mockResolvedValue(undefined),
    };
    tmuxSessionRepository = {
      killSession: jest.fn().mockResolvedValue(undefined),
    };
    cooldownStateRepository = {
      loadLastResetEpochSecondsBySessionName: jest.fn(),
      recordReset: jest.fn().mockResolvedValue(undefined),
    };
    sleeper = {
      sleep: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new SessionOutputDegenerationRecoveryUseCase(
      snapshotProvider,
      transcriptResolver,
      assistantTurnsRepository,
      notificationRepository,
      tmuxSessionRepository,
      cooldownStateRepository,
      sleeper,
    );
  });

  it('warns, waits the grace period, kills, and records the reset when enabled and degenerated (intra-turn)', async () => {
    await runWith({ enabled: true, turns: [repeat('court', 40)] });

    expect(
      notificationRepository.sendSelfCheckNotification,
    ).toHaveBeenCalledWith(SESSION_NAME, 'WARNING');
    expect(sleeper.sleep).toHaveBeenCalledWith(5000);
    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(
      SESSION_NAME,
    );
    expect(cooldownStateRepository.recordReset).toHaveBeenCalledWith({
      sessionName: SESSION_NAME,
      now,
    });
  });

  it('does not warn or kill in dry-run but still records the reset for cooldown', async () => {
    await runWith({ enabled: false, turns: [repeat('court', 40)] });

    expect(
      notificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
    expect(sleeper.sleep).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(cooldownStateRepository.recordReset).toHaveBeenCalledWith({
      sessionName: SESSION_NAME,
      now,
    });
  });

  it('skips a session that was reset within the cooldown window', async () => {
    await runWith({
      enabled: true,
      turns: [repeat('court', 40)],
      lastResetEpochSeconds: nowEpochSeconds - 100,
    });

    expect(
      notificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(cooldownStateRepository.recordReset).not.toHaveBeenCalled();
  });

  it('acts again once the cooldown window has elapsed', async () => {
    await runWith({
      enabled: true,
      turns: [repeat('court', 40)],
      lastResetEpochSeconds: nowEpochSeconds - 301,
    });

    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(
      SESSION_NAME,
    );
  });

  it('does not act on a healthy session', async () => {
    await runWith({
      enabled: true,
      turns: [
        'I finished the migration, verified the seed data, and uploaded the report.',
      ],
    });

    expect(
      notificationRepository.sendSelfCheckNotification,
    ).not.toHaveBeenCalled();
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
    expect(cooldownStateRepository.recordReset).not.toHaveBeenCalled();
  });

  it('resets a session detected only by the cross-turn signature', async () => {
    const clean = (index: number): string =>
      `Turn ${index}: completed and reported.`;
    const trailing = (index: number): string =>
      `Turn ${index}: real message.\n\ncourt`;
    const turns = [
      trailing(1),
      clean(2),
      trailing(3),
      clean(4),
      trailing(5),
      clean(6),
      trailing(7),
      clean(8),
      clean(9),
      clean(10),
    ];

    await runWith({ enabled: true, turns });

    expect(tmuxSessionRepository.killSession).toHaveBeenCalledWith(
      SESSION_NAME,
    );
  });

  it('does not act on a non-github-named interactive session', async () => {
    snapshotProvider.getSnapshot.mockResolvedValue(buildSnapshot('app'));
    transcriptResolver.resolveTranscriptPaths.mockReturnValue(new Map());
    assistantTurnsRepository.listRecentAssistantTurnsBySessionName.mockResolvedValue(
      new Map(),
    );
    cooldownStateRepository.loadLastResetEpochSecondsBySessionName.mockResolvedValue(
      new Map(),
    );

    await useCase.run({
      enabled: true,
      warningMessage: 'WARNING',
      graceSeconds: 5,
      cooldownSeconds: 300,
      now,
    });

    expect(
      assistantTurnsRepository.listRecentAssistantTurnsBySessionName,
    ).toHaveBeenCalledWith(new Map(), 10);
    expect(tmuxSessionRepository.killSession).not.toHaveBeenCalled();
  });
});
