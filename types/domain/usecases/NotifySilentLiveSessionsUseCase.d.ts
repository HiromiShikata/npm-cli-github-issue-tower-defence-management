import { LiveSessionProcessSnapshotProvider } from './adapter-interfaces/LiveSessionProcessSnapshotProvider';
import { InteractiveLiveSessionTranscriptResolver } from './adapter-interfaces/InteractiveLiveSessionTranscriptResolver';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
export declare const DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS: number;
export declare const DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS: number;
export declare const DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS: number;
export declare const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS: number;
export declare const DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
export declare const parseHubTaskIssueUrlFromSessionName: (sessionName: string) => string | null;
export type HubTaskStatusResolver = Pick<IssueRepository, 'getIssueByUrl'>;
export declare class NotifySilentLiveSessionsUseCase {
    private readonly liveSessionProcessSnapshotProvider;
    private readonly interactiveLiveSessionTranscriptResolver;
    private readonly sessionOutputActivityRepository;
    private readonly subAgentActivityRepository;
    private readonly ownerCallStatusProvider;
    private readonly notificationRepository;
    private readonly messageComposer;
    private readonly sleeper;
    private readonly hubTaskStatusResolver;
    private readonly resolveInteractiveLiveSessions;
    constructor(liveSessionProcessSnapshotProvider: LiveSessionProcessSnapshotProvider, interactiveLiveSessionTranscriptResolver: InteractiveLiveSessionTranscriptResolver, sessionOutputActivityRepository: SessionOutputActivityRepository, subAgentActivityRepository: SessionSubAgentActivityRepository, ownerCallStatusProvider: OwnerCallStatusProvider, notificationRepository: SilentSessionNotificationRepository, messageComposer: SilentSessionMessageComposer, sleeper: Sleeper, hubTaskStatusResolver?: HubTaskStatusResolver | null);
    run: (params: {
        mainSilentThresholdSeconds: number;
        subAgentSilentThresholdSeconds: number;
        subAgentRunningThresholdSeconds: number;
        cooldownSeconds: number;
        staggerSeconds: number;
        activeHubTaskStatus: string | null;
        now: Date;
    }) => Promise<void>;
    private isHubTaskActive;
    private collectSnapshots;
    private composeMessage;
}
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.d.ts.map