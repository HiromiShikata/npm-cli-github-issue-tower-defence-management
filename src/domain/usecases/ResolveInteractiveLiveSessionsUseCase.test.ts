import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';
import {
  LiveSessionProcessInfo,
  LiveSessionProcessSnapshot,
} from '../entities/LiveSessionProcessSnapshot';

describe('ResolveInteractiveLiveSessionsUseCase', () => {
  const useCase = new ResolveInteractiveLiveSessionsUseCase();

  const processInfo = (
    overrides: Partial<LiveSessionProcessInfo> &
      Pick<LiveSessionProcessInfo, 'pid' | 'ppid' | 'commandLine'>,
  ): LiveSessionProcessInfo => ({
    sessionId: null,
    currentSessionId: null,
    configDir: null,
    ...overrides,
  });

  it('resolves an issue-url-named session through its pane child process', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [
        {
          sessionName: 'https_//github_com/owner/repo/issues/9',
          panePids: [100],
        },
      ],
      processes: [
        processInfo({ pid: 100, ppid: 1, commandLine: 'tmux pane shell' }),
        processInfo({
          pid: 101,
          ppid: 100,
          commandLine: 'claude --model opus --resume abc',
          sessionId: 'abc',
          configDir: '/config/issues-9',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'https_//github_com/owner/repo/issues/9',
        sessionId: 'abc',
        candidateSessionIds: ['abc'],
        configDir: '/config/issues-9',
      },
    ]);
  });

  it('puts the rotated current session id before the launch env id', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'workbench', panePids: [200] }],
      processes: [
        processInfo({
          pid: 201,
          ppid: 200,
          commandLine: 'claude --name workbench',
          sessionId: 'launch-uuid',
          currentSessionId: 'rotated-uuid',
          configDir: '/config/workbench',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        sessionId: 'launch-uuid',
        candidateSessionIds: ['rotated-uuid', 'launch-uuid'],
        configDir: '/config/workbench',
      },
    ]);
  });

  it('keeps a single candidate id when the current id equals the launch id', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'workbench', panePids: [200] }],
      processes: [
        processInfo({
          pid: 201,
          ppid: 200,
          commandLine: 'claude --model opus --name workbench',
          sessionId: 'wb-uuid',
          currentSessionId: 'wb-uuid',
          configDir: '/config/workbench',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        candidateSessionIds: ['wb-uuid'],
        configDir: '/config/workbench',
      },
    ]);
  });

  it('finds the interactive process several levels below the pane', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'control-room', panePids: [300] }],
      processes: [
        processInfo({ pid: 300, ppid: 1, commandLine: 'shell' }),
        processInfo({ pid: 301, ppid: 300, commandLine: 'node wrapper' }),
        processInfo({
          pid: 302,
          ppid: 301,
          commandLine: 'claude --name control-room',
          sessionId: 'cr-uuid',
          configDir: '/config/control-room',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'control-room',
        sessionId: 'cr-uuid',
        candidateSessionIds: ['cr-uuid'],
        configDir: '/config/control-room',
      },
    ]);
  });

  it('excludes a session whose only claude process is an owner-handover spawn', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'aw-host', panePids: [400] }],
      processes: [
        processInfo({ pid: 400, ppid: 1, commandLine: 'shell' }),
        processInfo({
          pid: 401,
          ppid: 400,
          commandLine:
            'claude --verbose -p Take ownership of https://example.com/issues/1 and finish it',
          sessionId: 'aw-uuid',
          configDir: '/config/aw',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([]);
  });

  it('skips a session whose interactive process exposes no session id or config dir', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'partial', panePids: [500] }],
      processes: [
        processInfo({
          pid: 501,
          ppid: 500,
          commandLine: 'claude --model opus',
          configDir: '/config/partial',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([]);
  });

  it('ignores non-claude descendants such as monitors', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'monitored', panePids: [600] }],
      processes: [
        processInfo({
          pid: 601,
          ppid: 600,
          commandLine: 'node monitor.js',
          sessionId: 'mon-uuid',
          configDir: '/config/monitor',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([]);
  });

  it('resolves multiple sessions and drops the ones without an interactive process', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [
        { sessionName: 'workbench', panePids: [700] },
        { sessionName: 'empty', panePids: [800] },
      ],
      processes: [
        processInfo({
          pid: 701,
          ppid: 700,
          commandLine: 'claude --name workbench',
          sessionId: 'wb-uuid',
          configDir: '/config/workbench',
        }),
        processInfo({ pid: 801, ppid: 800, commandLine: 'bash idle' }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        candidateSessionIds: ['wb-uuid'],
        configDir: '/config/workbench',
      },
    ]);
  });

  it('collects the descendant-propagated session id after the own launch id for a non-resume session', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'non-resume', panePids: [900] }],
      processes: [
        processInfo({ pid: 900, ppid: 1, commandLine: 'shell' }),
        processInfo({
          pid: 901,
          ppid: 900,
          commandLine: 'claude --model opus',
          sessionId: 'launch-id',
          configDir: '/config/non-resume',
        }),
        processInfo({
          pid: 902,
          ppid: 901,
          commandLine: 'node tool worker',
          sessionId: 'harness-id',
          configDir: '/config/non-resume',
        }),
        processInfo({
          pid: 903,
          ppid: 902,
          commandLine: 'node nested worker',
          sessionId: 'harness-id',
          configDir: '/config/non-resume',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'non-resume',
        sessionId: 'launch-id',
        candidateSessionIds: ['launch-id', 'harness-id'],
        configDir: '/config/non-resume',
      },
    ]);
  });

  it('orders the rotated current id, then the launch id, then the descendant id', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'non-resume', panePids: [910] }],
      processes: [
        processInfo({ pid: 910, ppid: 1, commandLine: 'shell' }),
        processInfo({
          pid: 911,
          ppid: 910,
          commandLine: 'claude --model opus',
          sessionId: 'launch-id',
          currentSessionId: 'rotated-id',
          configDir: '/config/non-resume',
        }),
        processInfo({
          pid: 912,
          ppid: 911,
          commandLine: 'node tool worker',
          sessionId: 'harness-id',
          configDir: '/config/non-resume',
        }),
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'non-resume',
        sessionId: 'launch-id',
        candidateSessionIds: ['rotated-id', 'launch-id', 'harness-id'],
        configDir: '/config/non-resume',
      },
    ]);
  });

  it('returns an empty list when there are no sessions', () => {
    const result = useCase.resolve({ sessions: [], processes: [] });

    expect(result).toEqual([]);
  });
});
