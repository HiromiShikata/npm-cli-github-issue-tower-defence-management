"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveInteractiveLiveSessionsUseCase = exports.OWNER_HANDOVER_COMMAND_MARKER = void 0;
// Command-line substring that identifies an "owner-handover" agent spawn (for
// example a background implementation agent started with a prompt beginning
// "Take ownership of ..."). These spawns are not interactive owner sessions and
// MUST NOT be notified, so any process whose command line contains this marker
// is excluded even if it somehow appears under a monitored pane.
exports.OWNER_HANDOVER_COMMAND_MARKER = 'Take ownership of';
// Command-name substring that identifies the interactive Claude Code process.
const INTERACTIVE_PROCESS_COMMAND_MARKER = 'claude';
const isInteractiveCandidate = (process) => {
    if (process.commandLine.includes(exports.OWNER_HANDOVER_COMMAND_MARKER)) {
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
class ResolveInteractiveLiveSessionsUseCase {
    constructor() {
        this.resolve = (snapshot) => {
            const processByPid = new Map();
            const childrenByPpid = new Map();
            for (const process of snapshot.processes) {
                processByPid.set(process.pid, process);
                const siblings = childrenByPpid.get(process.ppid) ?? [];
                siblings.push(process);
                childrenByPpid.set(process.ppid, siblings);
            }
            const sessions = [];
            for (const session of snapshot.sessions) {
                const interactiveProcess = this.findInteractiveProcess(session.panePids, processByPid, childrenByPpid);
                if (interactiveProcess === null ||
                    interactiveProcess.sessionId === null ||
                    interactiveProcess.configDir === null) {
                    continue;
                }
                sessions.push({
                    sessionName: session.sessionName,
                    sessionId: interactiveProcess.sessionId,
                    candidateSessionIds: this.collectCandidateSessionIds(interactiveProcess),
                    configDir: interactiveProcess.configDir,
                });
            }
            return sessions;
        };
        this.collectCandidateSessionIds = (interactiveProcess) => {
            const candidateSessionIds = [];
            const seenSessionIds = new Set();
            for (const sessionId of [
                interactiveProcess.currentSessionId,
                interactiveProcess.sessionId,
            ]) {
                if (sessionId !== null && !seenSessionIds.has(sessionId)) {
                    seenSessionIds.add(sessionId);
                    candidateSessionIds.push(sessionId);
                }
            }
            return candidateSessionIds;
        };
        this.findInteractiveProcess = (panePids, processByPid, childrenByPpid) => {
            const visited = new Set();
            const queue = [...panePids];
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
}
exports.ResolveInteractiveLiveSessionsUseCase = ResolveInteractiveLiveSessionsUseCase;
//# sourceMappingURL=ResolveInteractiveLiveSessionsUseCase.js.map