import { ClaudeHandoverSession } from '../../domain/entities/ClaudeHandoverSession';
import { ClaudeHandoverSessionRepository } from '../../domain/usecases/adapter-interfaces/ClaudeHandoverSessionRepository';
export declare class ProcClaudeHandoverSessionRepository implements ClaudeHandoverSessionRepository {
    private readonly procDirectory;
    constructor(procDirectory?: string);
    listHandoverSessions: () => ClaudeHandoverSession[];
    private listProcessIdDirectories;
    private readHandoverSession;
    private readRunsUnderWorkspacePreparationScript;
    private readComm;
    private readCommandArguments;
    private readEnviron;
}
//# sourceMappingURL=ProcClaudeHandoverSessionRepository.d.ts.map