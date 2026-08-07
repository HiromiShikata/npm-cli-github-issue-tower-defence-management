import { SilentSessionNotificationRepository } from '../../domain/usecases/adapter-interfaces/SilentSessionNotificationRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { Sleeper } from '../../domain/usecases/adapter-interfaces/Sleeper';
export declare const DEFAULT_SUBMIT_PUSH_OUT_ATTEMPT_LIMIT = 3;
export declare const DEFAULT_SUBMIT_PUSH_OUT_WAIT_MILLISECONDS = 2500;
type InputBoxState = 'holdsMessage' | 'clearedMessage' | 'unreadable';
export declare const extractTmuxInputBoxContent: (paneText: string) => string | null;
export declare const resolveInputBoxStateFromPane: (paneText: string, singleLineMessage: string) => InputBoxState;
export declare class TmuxSilentSessionNotificationRepository implements SilentSessionNotificationRepository {
    private readonly localCommandRunner;
    private readonly sleeper;
    private readonly submitPushOutAttemptLimit;
    private readonly submitPushOutWaitMilliseconds;
    constructor(localCommandRunner: LocalCommandRunner, sleeper: Sleeper, submitPushOutAttemptLimit?: number, submitPushOutWaitMilliseconds?: number);
    sendSelfCheckNotification: (sessionName: string, message: string) => Promise<void>;
    private submitInputBox;
    private pushOutUnsubmittedMessage;
    private readInputBoxState;
}
export {};
//# sourceMappingURL=TmuxSilentSessionNotificationRepository.d.ts.map