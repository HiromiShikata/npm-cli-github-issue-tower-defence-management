import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { TmuxSessionRepository } from '../../domain/usecases/adapter-interfaces/TmuxSessionRepository';
export declare class NodeTmuxSessionRepository implements TmuxSessionRepository {
    private readonly localCommandRunner;
    constructor(localCommandRunner: LocalCommandRunner);
    listLiveSessionNames: () => Promise<string[]>;
    listInteractiveProcessCommandLines: () => Promise<string[]>;
    launchDetachedSession: (sessionName: string, launcherCommand: string, issueUrl: string) => Promise<void>;
}
//# sourceMappingURL=NodeTmuxSessionRepository.d.ts.map