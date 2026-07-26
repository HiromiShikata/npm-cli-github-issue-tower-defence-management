import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
export declare class NodeTmuxSessionRepository implements TmuxSessionRepository {
    private readonly localCommandRunner;
    private readonly procDirectory;
    constructor(localCommandRunner: LocalCommandRunner, procDirectory?: string);
    listLiveSessionNames: () => Promise<string[]>;
    listLiveSessionsWithActivity: () => Promise<LiveTmuxSession[]>;
    listInteractiveProcessCommandLines: () => Promise<string[]>;
    launchDetachedSession: (sessionName: string, launcherCommand: string, issueUrl: string) => Promise<void>;
    killSession: (sessionName: string) => Promise<void>;
    killOwnSession: () => Promise<void>;
    private stopScopeUnit;
}
//# sourceMappingURL=NodeTmuxSessionRepository.d.ts.map