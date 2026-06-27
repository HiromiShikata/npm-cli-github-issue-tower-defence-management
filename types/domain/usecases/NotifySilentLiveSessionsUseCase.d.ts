import { Project } from '../entities/Project';
import { IssueRepository } from './adapter-interfaces/IssueRepository';
import { OwnerCallStatusProvider } from './adapter-interfaces/OwnerCallStatusProvider';
import { SessionOutputActivityRepository } from './adapter-interfaces/SessionOutputActivityRepository';
import { SessionSubAgentActivityRepository } from './adapter-interfaces/SessionSubAgentActivityRepository';
import { SilentSessionMessageComposer } from './adapter-interfaces/SilentSessionMessageComposer';
import { SilentSessionNotificationRepository } from './adapter-interfaces/SilentSessionNotificationRepository';
import { Sleeper } from './adapter-interfaces/Sleeper';
import { TmuxSessionRepository } from './adapter-interfaces/TmuxSessionRepository';
export declare const DEFAULT_MONITORED_STATUS = "In Tmux by human";
export declare const DEFAULT_MAIN_SILENT_THRESHOLD_SECONDS: number;
export declare const DEFAULT_SUBAGENT_SILENT_THRESHOLD_SECONDS: number;
export declare const DEFAULT_SUBAGENT_RUNNING_THRESHOLD_SECONDS: number;
export declare const DEFAULT_NOTIFICATION_COOLDOWN_SECONDS: number;
export declare const DEFAULT_NOTIFICATION_STAGGER_SECONDS = 25;
export declare class NotifySilentLiveSessionsUseCase {
    private readonly issueRepository;
    private readonly tmuxSessionRepository;
    private readonly sessionOutputActivityRepository;
    private readonly subAgentActivityRepository;
    private readonly ownerCallStatusProvider;
    private readonly notificationRepository;
    private readonly messageComposer;
    private readonly sleeper;
    constructor(issueRepository: Pick<IssueRepository, 'getAllOpened'>, tmuxSessionRepository: Pick<TmuxSessionRepository, 'listLiveSessionNames'>, sessionOutputActivityRepository: SessionOutputActivityRepository, subAgentActivityRepository: SessionSubAgentActivityRepository, ownerCallStatusProvider: OwnerCallStatusProvider, notificationRepository: SilentSessionNotificationRepository, messageComposer: SilentSessionMessageComposer, sleeper: Sleeper);
    run: (params: {
        project: Project;
        allowCacheMinutes: number;
        monitoredStatus: string;
        mainSilentThresholdSeconds: number;
        subAgentSilentThresholdSeconds: number;
        subAgentRunningThresholdSeconds: number;
        cooldownSeconds: number;
        staggerSeconds: number;
        now: Date;
    }) => Promise<void>;
    private collectSnapshots;
    private composeMessage;
    private selectMonitoredSessionNames;
}
//# sourceMappingURL=NotifySilentLiveSessionsUseCase.d.ts.map