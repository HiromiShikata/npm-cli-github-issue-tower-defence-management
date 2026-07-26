import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { SessionAssistantTurnsRepository } from './adapter-interfaces/SessionAssistantTurnsRepository';
import { SessionDegenerationCooldownStateRepository } from './adapter-interfaces/SessionDegenerationCooldownStateRepository';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { OutputDegenerationDetector } from './OutputDegenerationDetector';
export declare const DEFAULT_OUTPUT_DEGENERATION_GRACE_SECONDS = 5;
export declare const DEFAULT_OUTPUT_DEGENERATION_COOLDOWN_SECONDS = 300;
export declare const DEFAULT_OUTPUT_DEGENERATION_WARNING_MESSAGE = "OUTPUT DEGENERATION DETECTED: your session is about to be reset. Immediately write a checkpoint to your assigned task issue (single concrete next action to resume, working directory and branch, in-flight sub-agent branch/PR URLs).";
export declare class SessionOutputDegenerationRecoveryUseCase {
    private readonly liveSessionProcessSnapshotProvider;
    private readonly interactiveLiveSessionTranscriptResolver;
    private readonly assistantTurnsRepository;
    private readonly notificationRepository;
    private readonly tmuxSessionRepository;
    private readonly cooldownStateRepository;
    private readonly sleeper;
    private readonly detector;
    private readonly resolveInteractiveLiveSessions;
    constructor(liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver, assistantTurnsRepository: SessionAssistantTurnsRepository, notificationRepository: SilentSessionNotificationRepository, tmuxSessionRepository: Pick<TmuxSessionRepository, 'killSession'>, cooldownStateRepository: SessionDegenerationCooldownStateRepository, sleeper: Sleeper, detector?: OutputDegenerationDetector);
    run: (params: {
        enabled: boolean;
        warningMessage: string;
        graceSeconds: number;
        cooldownSeconds: number;
        now: Date;
    }) => Promise<void>;
}
//# sourceMappingURL=SessionOutputDegenerationRecoveryUseCase.d.ts.map