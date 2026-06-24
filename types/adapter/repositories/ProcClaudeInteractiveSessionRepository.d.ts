import { ClaudeInteractiveSession, ClaudeInteractiveSessionRepository } from '../../domain/usecases/adapter-interfaces/ClaudeInteractiveSessionRepository';
export declare class ProcClaudeInteractiveSessionRepository implements ClaudeInteractiveSessionRepository {
    private readonly procDirectory;
    constructor(procDirectory?: string);
    listInteractiveSessions: () => ClaudeInteractiveSession[];
    private listProcessIdDirectories;
    private readInteractiveSession;
    private readCommandArguments;
    private readEnviron;
}
//# sourceMappingURL=ProcClaudeInteractiveSessionRepository.d.ts.map