import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { LiveSessionProcessSnapshotProvider } from '../../domain/usecases/adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { ProcessEnvironReader } from '../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { SessionRecordReader } from '../../domain/usecases/adapter-interfaces/SessionRecordReader';
import {
  LiveSessionPaneProcess,
  LiveSessionProcessInfo,
  LiveSessionProcessSnapshot,
} from '../../domain/entities/LiveSessionProcessSnapshot';
import { FileSystemSessionRecordReader } from './FileSystemSessionRecordReader';

const SESSION_ID_ENV_KEY = 'CLAUDE_CODE_SESSION_ID';
const CONFIG_DIR_ENV_KEY = 'CLAUDE_CONFIG_DIR';

/**
 * Builds a live-session process snapshot from the local host: it lists the live
 * tmux sessions and each session's pane process ids, lists the full process
 * tree with command lines, and reads each process environment to expose the
 * Claude Code session id and config directory. The snapshot is consumed by a
 * pure resolver, so all host access is contained in this adapter.
 */
export class LocalProcessLiveSessionProcessSnapshotProvider implements LiveSessionProcessSnapshotProvider {
  constructor(
    private readonly localCommandRunner: LocalCommandRunner,
    private readonly environReader: ProcessEnvironReader,
    private readonly sessionRecordReader: SessionRecordReader = new FileSystemSessionRecordReader(),
  ) {}

  getSnapshot = async (): Promise<LiveSessionProcessSnapshot> => {
    const sessionNames = await this.listSessionNames();
    const sessions: LiveSessionPaneProcess[] = [];
    for (const sessionName of sessionNames) {
      const panePids = await this.listPanePids(sessionName);
      sessions.push({ sessionName, panePids });
    }
    const processes = await this.listProcesses();
    return { sessions, processes };
  };

  private listSessionNames = async (): Promise<string[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['list-sessions', '-F', '#{session_name}'],
    );
    if (exitCode !== 0) {
      return [];
    }
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  private listPanePids = async (sessionName: string): Promise<number[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'tmux',
      ['list-panes', '-t', sessionName, '-F', '#{pane_pid}'],
    );
    if (exitCode !== 0) {
      return [];
    }
    return stdout
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  };

  private listProcesses = async (): Promise<LiveSessionProcessInfo[]> => {
    const { stdout, exitCode } = await this.localCommandRunner.runCommand(
      'ps',
      ['-eo', 'pid=,ppid=,args='],
    );
    if (exitCode !== 0) {
      return [];
    }
    const processes: LiveSessionProcessInfo[] = [];
    for (const line of stdout.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/);
      if (match === null) {
        continue;
      }
      const pid = Number(match[1]);
      const ppid = Number(match[2]);
      const commandLine = match[3].trim();
      const environ = this.environReader.readEnviron(pid);
      const configDir = environ?.[CONFIG_DIR_ENV_KEY] ?? null;
      const currentSessionId =
        configDir === null
          ? null
          : this.sessionRecordReader.readCurrentSessionId(configDir, pid);
      processes.push({
        pid,
        ppid,
        commandLine,
        sessionId: environ?.[SESSION_ID_ENV_KEY] ?? null,
        currentSessionId,
        configDir,
      });
    }
    return processes;
  };
}
