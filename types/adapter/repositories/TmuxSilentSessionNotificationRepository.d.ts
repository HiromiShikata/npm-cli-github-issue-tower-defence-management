import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { LocalStorageCacheRepository } from './LocalStorageCacheRepository';
export declare class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
    private readonly localCommandRunner;
    private readonly cacheRepository;
    constructor(localCommandRunner: LocalCommandRunner, cacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>);
    getLastNotifiedEpochSeconds: (sessionName: string) => Promise<number | null>;
    setLastNotifiedEpochSeconds: (sessionName: string, epochSeconds: number) => Promise<void>;
    sendSelfCheckNotification: (sessionName: string, message: string) => Promise<void>;
    private toCacheKey;
}
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.d.ts.map