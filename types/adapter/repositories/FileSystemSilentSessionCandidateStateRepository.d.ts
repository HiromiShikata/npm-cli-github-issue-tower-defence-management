import { SilentSessionCandidateStateRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionCandidateStateRepository';
export declare const DEFAULT_STATE_RETENTION_WINDOW_SECONDS: number;
export declare class FileSystemSilentSessionCandidateStateRepository implements SilentSessionCandidateStateRepository {
    private readonly stateFilePath;
    private readonly retentionWindowSeconds;
    constructor(stateFilePath?: string, retentionWindowSeconds?: number);
    loadRecentCandidateSessionNames: (params: {
        now: Date;
        recencyWindowSeconds: number;
    }) => Promise<Set<string>>;
    saveCandidateSessionNames: (params: {
        sessionNames: string[];
        now: Date;
    }) => Promise<void>;
    private readState;
    private readCandidateEntries;
    private writeState;
}
//# sourceMappingURL=FileSystemSilentSessionCandidateStateRepository.d.ts.map