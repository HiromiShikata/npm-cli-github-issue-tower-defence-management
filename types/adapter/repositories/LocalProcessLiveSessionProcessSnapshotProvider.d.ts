import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { LiveSessionProcessSnapshotProvider } from '../../domain/usecases/adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { ProcessEnvironReader } from '../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { LiveSessionProcessSnapshot } from '../../domain/entities/LiveSessionProcessSnapshot';
/**
 * Builds a live-session process snapshot from the local host: it lists the live
 * tmux sessions and each session's pane process ids, lists the full process
 * tree with command lines, and reads each process environment to expose the
 * Claude Code session id and config directory. The snapshot is consumed by a
 * pure resolver, so all host access is contained in this adapter.
 */
export declare class LocalProcessLiveSessionProcessSnapshotProvider implements LiveSessionProcessSnapshotProvider {
    private readonly localCommandRunner;
    private readonly environReader;
    constructor(localCommandRunner: LocalCommandRunner, environReader: ProcessEnvironReader);
    getSnapshot: () => Promise<LiveSessionProcessSnapshot>;
    private listSessionNames;
    private listPanePids;
    private listProcesses;
}
//# sourceMappingURL=LocalProcessLiveSessionProcessSnapshotProvider.d.ts.map