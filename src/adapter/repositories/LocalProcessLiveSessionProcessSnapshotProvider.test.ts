import { LocalProcessLiveSessionProcessSnapshotProvider } from './LocalProcessLiveSessionProcessSnapshotProvider';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { SessionRecordReader } from '../../domain/usecases/adapter-interfaces/SessionRecordReader';

describe('LocalProcessLiveSessionProcessSnapshotProvider', () => {
  const makeRunner = (
    handlers: Record<
      string,
      { stdout: string; stderr?: string; exitCode?: number }
    >,
  ): LocalCommandRunner => ({
    runCommand: jest.fn(async (program: string, args: string[]) => {
      const key = `${program} ${args.join(' ')}`;
      const handler = handlers[key];
      if (handler === undefined) {
        return { stdout: '', stderr: '', exitCode: 1 };
      }
      return {
        stdout: handler.stdout,
        stderr: handler.stderr ?? '',
        exitCode: handler.exitCode ?? 0,
      };
    }),
  });

  const makeEnvironReader = (
    byPid: Record<number, Record<string, string>>,
  ): ProcessEnvironReader => ({
    readEnviron: (pid: number) => byPid[pid] ?? null,
  });

  const makeSessionRecordReader = (
    byPid: Record<number, string>,
  ): SessionRecordReader => ({
    readCurrentSessionId: (_configDir: string, pid: number) =>
      byPid[pid] ?? null,
  });

  it('builds a snapshot of sessions, pane pids, and processes with environment', async () => {
    const runner = makeRunner({
      'tmux list-sessions -F #{session_name}': {
        stdout: 'workbench\nhttps_//github_com/owner/repo/issues/9\n',
      },
      'tmux list-panes -t workbench -F #{pane_pid}': { stdout: '200\n' },
      'tmux list-panes -t https_//github_com/owner/repo/issues/9 -F #{pane_pid}':
        { stdout: '100\n' },
      'ps -eo pid=,ppid=,args=': {
        stdout: [
          '    100       1 shell',
          '    101     100 claude --name issues-9',
          '    200       1 shell',
          '    201     200 claude --name workbench',
        ].join('\n'),
      },
    });
    const environReader = makeEnvironReader({
      101: {
        CLAUDE_CODE_SESSION_ID: 'issue-uuid',
        CLAUDE_CONFIG_DIR: '/config/issues-9',
      },
      201: {
        CLAUDE_CODE_SESSION_ID: 'wb-uuid',
        CLAUDE_CONFIG_DIR: '/config/workbench',
      },
    });
    const sessionRecordReader = makeSessionRecordReader({
      101: 'issue-rotated-uuid',
      201: 'wb-rotated-uuid',
    });
    const provider = new LocalProcessLiveSessionProcessSnapshotProvider(
      runner,
      environReader,
      sessionRecordReader,
    );

    const snapshot = await provider.getSnapshot();

    expect(snapshot.sessions).toEqual([
      { sessionName: 'workbench', panePids: [200] },
      {
        sessionName: 'https_//github_com/owner/repo/issues/9',
        panePids: [100],
      },
    ]);
    expect(snapshot.processes).toContainEqual({
      pid: 201,
      ppid: 200,
      commandLine: 'claude --name workbench',
      sessionId: 'wb-uuid',
      currentSessionId: 'wb-rotated-uuid',
      configDir: '/config/workbench',
    });
    expect(snapshot.processes).toContainEqual({
      pid: 100,
      ppid: 1,
      commandLine: 'shell',
      sessionId: null,
      currentSessionId: null,
      configDir: null,
    });
  });

  it('leaves currentSessionId null when the session record is absent', async () => {
    const runner = makeRunner({
      'tmux list-sessions -F #{session_name}': { stdout: 'workbench\n' },
      'tmux list-panes -t workbench -F #{pane_pid}': { stdout: '200\n' },
      'ps -eo pid=,ppid=,args=': {
        stdout: '    201     200 claude --name workbench',
      },
    });
    const provider = new LocalProcessLiveSessionProcessSnapshotProvider(
      runner,
      makeEnvironReader({
        201: {
          CLAUDE_CODE_SESSION_ID: 'wb-uuid',
          CLAUDE_CONFIG_DIR: '/config/workbench',
        },
      }),
      makeSessionRecordReader({}),
    );

    const snapshot = await provider.getSnapshot();

    expect(snapshot.processes).toEqual([
      {
        pid: 201,
        ppid: 200,
        commandLine: 'claude --name workbench',
        sessionId: 'wb-uuid',
        currentSessionId: null,
        configDir: '/config/workbench',
      },
    ]);
  });

  it('returns an empty snapshot when tmux reports no sessions', async () => {
    const runner = makeRunner({
      'tmux list-sessions -F #{session_name}': { stdout: '' },
      'ps -eo pid=,ppid=,args=': { stdout: '' },
    });
    const provider = new LocalProcessLiveSessionProcessSnapshotProvider(
      runner,
      makeEnvironReader({}),
      makeSessionRecordReader({}),
    );

    const snapshot = await provider.getSnapshot();

    expect(snapshot.sessions).toEqual([]);
    expect(snapshot.processes).toEqual([]);
  });

  it('skips malformed ps lines', async () => {
    const runner = makeRunner({
      'tmux list-sessions -F #{session_name}': { stdout: 'workbench\n' },
      'tmux list-panes -t workbench -F #{pane_pid}': { stdout: '200\n' },
      'ps -eo pid=,ppid=,args=': {
        stdout: [
          'garbage line',
          '    201     200 claude --name workbench',
        ].join('\n'),
      },
    });
    const provider = new LocalProcessLiveSessionProcessSnapshotProvider(
      runner,
      makeEnvironReader({
        201: {
          CLAUDE_CODE_SESSION_ID: 'wb-uuid',
          CLAUDE_CONFIG_DIR: '/config/workbench',
        },
      }),
      makeSessionRecordReader({ 201: 'wb-rotated-uuid' }),
    );

    const snapshot = await provider.getSnapshot();

    expect(snapshot.processes).toEqual([
      {
        pid: 201,
        ppid: 200,
        commandLine: 'claude --name workbench',
        sessionId: 'wb-uuid',
        currentSessionId: 'wb-rotated-uuid',
        configDir: '/config/workbench',
      },
    ]);
  });
});
