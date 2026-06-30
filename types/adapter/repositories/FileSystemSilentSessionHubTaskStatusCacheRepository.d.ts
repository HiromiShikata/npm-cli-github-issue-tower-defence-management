import { Issue } from '../../domain/entities/Issue';
import { SilentSessionHubTaskStatusCacheEntry, SilentSessionHubTaskStatusCacheRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionHubTaskStatusCacheRepository';
export declare const DEFAULT_HUB_TASK_STATUS_RETENTION_WINDOW_SECONDS: number;
export declare class FileSystemSilentSessionHubTaskStatusCacheRepository implements SilentSessionHubTaskStatusCacheRepository {
    private readonly stateFilePath;
    private readonly retentionWindowSeconds;
    constructor(stateFilePath?: string, retentionWindowSeconds?: number);
    loadHubTaskStatus: (params: {
        url: string;
    }) => Promise<SilentSessionHubTaskStatusCacheEntry | null>;
    saveHubTaskStatus: (params: {
        url: string;
        state: Issue["state"];
        status: string | null;
        now: Date;
    }) => Promise<void>;
    private readEntries;
    private writeEntries;
}
//# sourceMappingURL=FileSystemSilentSessionHubTaskStatusCacheRepository.d.ts.map