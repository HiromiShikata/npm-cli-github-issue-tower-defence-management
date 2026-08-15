import { SessionDegenerationCooldownStateRepository } from '../../domain/usecases/adapter-interfaces/SessionDegenerationCooldownStateRepository';
export declare const DEFAULT_RESET_RETENTION_WINDOW_SECONDS: number;
export declare const defaultSessionDegenerationCooldownStateFilePath: () => string;
export declare class FileSystemSessionDegenerationCooldownStateRepository implements SessionDegenerationCooldownStateRepository {
    private readonly stateFilePath;
    private readonly retentionWindowSeconds;
    constructor(stateFilePath?: string, retentionWindowSeconds?: number);
    loadLastResetEpochSecondsBySessionName: () => Promise<Map<string, number>>;
    recordReset: (params: {
        sessionName: string;
        now: Date;
    }) => Promise<void>;
    private readResetEntries;
    private writeState;
}
//# sourceMappingURL=FileSystemSessionDegenerationCooldownStateRepository.d.ts.map