import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export declare class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
    private readonly localCommandRunner;
    constructor(localCommandRunner: LocalCommandRunner);
    sendSelfCheckNotification: (sessionName: string, message: string) => Promise<void>;
}
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.d.ts.map