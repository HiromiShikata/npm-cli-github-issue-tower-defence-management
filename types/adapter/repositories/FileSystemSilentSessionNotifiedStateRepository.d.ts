import { SilentSessionNotifiedStateRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotifiedStateRepository';
export declare class FileSystemSilentSessionNotifiedStateRepository implements SilentSessionNotifiedStateRepository {
    private readonly stateFilePath;
    constructor(stateFilePath?: string);
    loadRecentNotifiedSessionNames: (params: {
        now: Date;
        recencyWindowSeconds: number;
    }) => Promise<Set<string>>;
    saveNotifiedSessionNames: (params: {
        sessionNames: string[];
        now: Date;
    }) => Promise<void>;
    private readNotifiedEntries;
    private writeState;
}
//# sourceMappingURL=FileSystemSilentSessionNotifiedStateRepository.d.ts.map