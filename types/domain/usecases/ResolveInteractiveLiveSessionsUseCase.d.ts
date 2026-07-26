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
    private collectCandidateSessionIds;
    private findInteractiveProcess;
}
//# sourceMappingURL=ResolveInteractiveLiveSessionsUseCase.d.ts.map