import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
import { LiveTmuxSession } from '../../domain/entities/LiveTmuxSession';
export declare class NodeTmuxSessionRepository implements TmuxSessionRepository {
    private readonly localCommandRunner;
    private readonly procDirectory;
    private readonly submitDelayMilliseconds;
    constructor(localCommandRunner: LocalCommandRunner, procDirectory?: string, submitDelayMilliseconds?: number);
    listLiveSessionNames: () => Promise<string[]>;
    listLiveSessionsWithActivity: () => Promise<LiveTmuxSession[]>;
    listInteractiveProcessCommandLines: () => Promise<string[]>;
    launchDetachedSession: (sessionName: string, launcherCommand: string, issueUrl: string) => Promise<void>;
    killSession: (sessionName: string) => Promise<void>;
    killOwnSession: () => Promise<void>;
    private stopScopeUnit;
    sendKeys: (sessionName: string, literalText: string) => Promise<void>;
    attachOrCreateInteractiveSession: (issueUrl: string, scopeLibPath: string | null) => Promise<void>;
    launchBareNameLeaderSession: (name: string) => Promise<void>;
    private sendEnter;
    private delaySubmit;
}
//# sourceMappingURL=NodeTmuxSessionRepository.d.ts.map