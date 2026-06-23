import { ClaudeLiveSession, ClaudeLiveSessionRepository } from '../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
export declare class ProcClaudeLiveSessionRepository implements ClaudeLiveSessionRepository {
    private readonly procDirectory;
    constructor(procDirectory?: string);
    listLiveSessions: () => ClaudeLiveSession[];
    private listProcessIdDirectories;
    private readLiveSession;
    private isClaudeProcess;
    private readEnviron;
}
//# sourceMappingURL=ProcClaudeLiveSessionRepository.d.ts.map