import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
export declare class NodeTmuxSessionRepository implements TmuxSessionRepository {
    private readonly localCommandRunner;
    constructor(localCommandRunner: LocalCommandRunner);
    listLiveSessionNames: () => Promise<string[]>;
    listLiveSessionsWithActivity: () => Promise<LiveTmuxSession[]>;
    listInteractiveProcessCommandLines: () => Promise<string[]>;
    launchDetachedSession: (sessionName: string, launcherCommand: string, issueUrl: string) => Promise<void>;
    killSession: (sessionName: string) => Promise<void>;
    sendKeys: (sessionName: string, literalText: string) => Promise<void>;
}
//# sourceMappingURL=NodeTmuxSessionRepository.d.ts.map