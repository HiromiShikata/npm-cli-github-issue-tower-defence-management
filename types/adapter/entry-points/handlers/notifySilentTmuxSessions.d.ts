import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { ProcessEnvironReader } from '../../../domain/usecases/adapter-interfaces/ProcessEnvironReader';
import { HubTaskStatusResolver } from '../../../domain/usecases/NotifySilentLiveSessionsUseCase';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
export type NotifySilentTmuxSessionsParams = {
    enabled: boolean;
    localCommandRunner: LocalCommandRunner;
    processEnvironReader?: ProcessEnvironReader;
    cacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
    ownerCallMarker: string | null;
    subAgentOutputRootDirectory: string | null;
    subAgentProcessMatchPattern: string | null;
    subAgentTranscriptRootDirectory: string | null;
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
    activeHubTaskStatus: string | null;
    hubTaskStatusResolver: HubTaskStatusResolver | null;
    messageTemplates: SilentSessionMessageTemplates;
    now: Date;
};
export declare const notifySilentTmuxSessions: (params: NotifySilentTmuxSessionsParams) => Promise<void>;
export declare const DEFAULT_NOTIFY_SILENT_TMUX_SESSIONS_PARAMS: {
    readonly mainSilentThresholdSeconds: number;
    readonly subAgentSilentThresholdSeconds: number;
    readonly subAgentRunningThresholdSeconds: number;
    readonly cooldownSeconds: number;
    readonly staggerSeconds: 25;
};
//# sourceMappingURL=notifySilentTmuxSessions.d.ts.map