import { ResolveInteractiveLiveSessionsUseCase } from './ResolveInteractiveLiveSessionsUseCase';
import { LiveSessionProcessSnapshot } from '../entities/LiveSessionProcessSnapshot';

describe('ResolveInteractiveLiveSessionsUseCase', () => {
  const useCase = new ResolveInteractiveLiveSessionsUseCase();

  it('resolves an issue-url-named session through its pane child process', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [
        {
          sessionName: 'https_//github_com/owner/repo/issues/9',
          panePids: [100],
        },
      ],
      processes: [
        {
          pid: 100,
          ppid: 1,
          commandLine: 'tmux pane shell',
          sessionId: null,
          configDir: null,
        },
        {
          pid: 101,
          ppid: 100,
          commandLine: 'claude --model opus --resume abc',
          sessionId: 'abc',
          configDir: '/config/issues-9',
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'https_//github_com/owner/repo/issues/9',
        sessionId: 'abc',
        configDir: '/config/issues-9',
      },
    ]);
  });

  it('resolves a plain-named session such as workbench', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'workbench', panePids: [200] }],
      processes: [
        {
          pid: 200,
          ppid: 1,
          commandLine: 'shell',
          sessionId: null,
          configDir: null,
        },
        {
          pid: 201,
          ppid: 200,
          commandLine: 'claude --model opus --name workbench',
          sessionId: 'wb-uuid',
          configDir: '/config/workbench',
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        configDir: '/config/workbench',
      },
    ]);
  });

  it('finds the interactive process several levels below the pane', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'control-room', panePids: [300] }],
      processes: [
        {
          pid: 300,
          ppid: 1,
          commandLine: 'shell',
          sessionId: null,
          configDir: null,
        },
        {
          pid: 301,
          ppid: 300,
          commandLine: 'node wrapper',
          sessionId: null,
          configDir: null,
        },
        {
          pid: 302,
          ppid: 301,
          commandLine: 'claude --name control-room',
          sessionId: 'cr-uuid',
          configDir: '/config/control-room',
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'control-room',
        sessionId: 'cr-uuid',
        configDir: '/config/control-room',
      },
    ]);
  });

  it('excludes a session whose only claude process is an owner-handover spawn', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'aw-host', panePids: [400] }],
      processes: [
        {
          pid: 400,
          ppid: 1,
          commandLine: 'shell',
          sessionId: null,
          configDir: null,
        },
        {
          pid: 401,
          ppid: 400,
          commandLine:
            'claude --verbose -p Take ownership of https://example.com/issues/1 and finish it',
          sessionId: 'aw-uuid',
          configDir: '/config/aw',
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([]);
  });

  it('skips a session whose interactive process exposes no session id or config dir', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'partial', panePids: [500] }],
      processes: [
        {
          pid: 501,
          ppid: 500,
          commandLine: 'claude --model opus',
          sessionId: null,
          configDir: '/config/partial',
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([]);
  });

  it('ignores non-claude descendants such as monitors', () => {
    const snapshot: LiveSessionProcessSnapshot = {
      sessions: [{ sessionName: 'monitored', panePids: [600] }],
      processes: [
        {
          pid: 601,
          ppid: 600,
          commandLine: 'node monitor.js',
          sessionId: 'mon-uuid',
          configDir: '/config/monitor',
        },
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
        {
          pid: 701,
          ppid: 700,
          commandLine: 'claude --name workbench',
          sessionId: 'wb-uuid',
          configDir: '/config/workbench',
        },
        {
          pid: 801,
          ppid: 800,
          commandLine: 'bash idle',
          sessionId: null,
          configDir: null,
        },
      ],
    };

    const result = useCase.resolve(snapshot);

    expect(result).toEqual([
      {
        sessionName: 'workbench',
        sessionId: 'wb-uuid',
        configDir: '/config/workbench',
      },
    ]);
  });

  it('returns an empty list when there are no sessions', () => {
    const result = useCase.resolve({ sessions: [], processes: [] });

    expect(result).toEqual([]);
  });
});
