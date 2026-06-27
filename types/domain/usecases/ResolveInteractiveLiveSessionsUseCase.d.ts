import { InteractiveLiveSession } from '../entities/InteractiveLiveSession';
import { LiveSessionProcessSnapshot } from '../entities/LiveSessionProcessSnapshot';
export declare const OWNER_HANDOVER_COMMAND_MARKER = "Take ownership of";
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
export declare class ResolveInteractiveLiveSessionsUseCase {
    resolve: (snapshot: LiveSessionProcessSnapshot) => InteractiveLiveSession[];
    private findInteractiveProcess;
}
//# sourceMappingURL=ResolveInteractiveLiveSessionsUseCase.d.ts.map