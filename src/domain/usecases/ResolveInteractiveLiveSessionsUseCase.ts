import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';
import {
  LiveSessionProcessInfo,
  LiveSessionProcessSnapshot,
} from '../entities/LiveSessionProcessSnapshot';

// Command-line substring that identifies an "owner-handover" agent spawn (for
// example a background implementation agent started with a prompt beginning
// "Take ownership of ..."). These spawns are not interactive owner sessions and
// MUST NOT be notified, so any process whose command line contains this marker
// is excluded even if it somehow appears under a monitored pane.
export const OWNER_HANDOVER_COMMAND_MARKER = 'Take ownership of';

// Command-name substring that identifies the interactive Claude Code process.
const INTERACTIVE_PROCESS_COMMAND_MARKER = 'claude';

const isInteractiveCandidate = (process: LiveSessionProcessInfo): boolean => {
  if (process.commandLine.includes(OWNER_HANDOVER_COMMAND_MARKER)) {
    return false;
  }
  if (!process.commandLine.includes(INTERACTIVE_PROCESS_COMMAND_MARKER)) {
    return false;
  }
  return process.sessionId !== null && process.configDir !== null;
};

/**
 * Selects the interactive Claude Code sessions that are eligible for the silent
 * self-check notification, independently of session naming or any GitHub issue
 * linkage.
 *
 * Selection works purely from a process snapshot: for each live tmux session,
 * the descendants of its pane processes are walked, and the first descendant
 * that looks like an interactive Claude Code process (command line contains
 * `claude`, does not contain the owner-handover marker, and exposes both a
 * session id and a config directory in its environment) is taken as the
 * session's interactive process. Because the walk is anchored on tmux panes,
 * background owner-handover spawns, the preparation daemon, and monitor
 * processes — none of which run inside an interactive tmux pane — are naturally
 * excluded; the explicit owner-handover marker check is an additional guard.
 */
export class ResolveInteractiveLiveSessionsUseCase {
  resolve = (
    snapshot: LiveSessionProcessSnapshot,
  ): InteractiveLiveSession[] => {
    const processByPid = new Map<number, LiveSessionProcessInfo>();
    const childrenByPpid = new Map<number, LiveSessionProcessInfo[]>();
    for (const process of snapshot.processes) {
      processByPid.set(process.pid, process);
      const siblings = childrenByPpid.get(process.ppid) ?? [];
      siblings.push(process);
      childrenByPpid.set(process.ppid, siblings);
    }

    const sessions: InteractiveLiveSession[] = [];
    for (const session of snapshot.sessions) {
      const interactiveProcess = this.findInteractiveProcess(
        session.panePids,
        processByPid,
        childrenByPpid,
      );
      if (
        interactiveProcess === null ||
        interactiveProcess.sessionId === null ||
        interactiveProcess.configDir === null
      ) {
        continue;
      }
      const candidateSessionIds = this.collectCandidateSessionIds(
        interactiveProcess,
        childrenByPpid,
      );
      sessions.push({
        sessionName: session.sessionName,
        sessionId: interactiveProcess.sessionId,
        candidateSessionIds,
        configDir: interactiveProcess.configDir,
      });
    }
    return sessions;
  };

  /**
   * Collects the distinct session ids that may name the actively-written
   * transcript on disk, in priority order. The rotated current session id
   * recorded for the interactive process is first, because for a resumed or
   * compacted session the id rotates and the live transcript is named by the
   * current id. The interactive process's own launch id follows, then the
   * distinct ids propagated to its descendant processes. For a `--resume`
   * session these ids coincide, yielding a single id; for a non-resume session
   * the own (launch) id names no transcript and the live transcript is named by
   * the descendant-propagated id, which is included here so the resolver can
   * find the actively-written file.
   */
  private collectCandidateSessionIds = (
    interactiveProcess: LiveSessionProcessInfo,
    childrenByPpid: Map<number, LiveSessionProcessInfo[]>,
  ): string[] => {
    const candidateSessionIds: string[] = [];
    const seenSessionIds = new Set<string>();
    const pushSessionId = (sessionId: string | null): void => {
      if (sessionId !== null && !seenSessionIds.has(sessionId)) {
        seenSessionIds.add(sessionId);
        candidateSessionIds.push(sessionId);
      }
    };
    pushSessionId(interactiveProcess.currentSessionId);
    const visitedPids = new Set<number>();
    const queue: LiveSessionProcessInfo[] = [interactiveProcess];
    let head = 0;
    while (head < queue.length) {
      const process = queue[head];
      head += 1;
      if (visitedPids.has(process.pid)) {
        continue;
      }
      visitedPids.add(process.pid);
      pushSessionId(process.sessionId);
      for (const child of childrenByPpid.get(process.pid) ?? []) {
        if (!visitedPids.has(child.pid)) {
          queue.push(child);
        }
      }
    }
    return candidateSessionIds;
  };

  private findInteractiveProcess = (
    panePids: number[],
    processByPid: Map<number, LiveSessionProcessInfo>,
    childrenByPpid: Map<number, LiveSessionProcessInfo[]>,
  ): LiveSessionProcessInfo | null => {
    const visited = new Set<number>();
    const queue: number[] = [...panePids];
    let head = 0;
    while (head < queue.length) {
      const pid = queue[head];
      head += 1;
      if (visited.has(pid)) {
        continue;
      }
      visited.add(pid);
      const process = processByPid.get(pid);
      if (process !== undefined && isInteractiveCandidate(process)) {
        return process;
      }
      for (const child of childrenByPpid.get(pid) ?? []) {
        if (!visited.has(child.pid)) {
          queue.push(child.pid);
        }
      }
    }
    return null;
  };
}
