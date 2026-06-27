import { Project } from '../../../domain/entities/Project';
import { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { LocalStorageCacheRepository } from '../../repositories/LocalStorageCacheRepository';
import { SilentSessionMessageTemplates } from '../../repositories/ConfigurableSilentSessionMessageComposer';
export type NotifySilentTmuxSessionsParams = {
    project: Project;
    allowCacheMinutes: number;
    issueRepository: Pick<IssueRepository, 'getAllOpened'>;
    localCommandRunner: LocalCommandRunner;
    cacheRepository: Pick<LocalStorageCacheRepository, 'getLatest' | 'set'>;
    sessionOutputRootDirectory: string | null;
    sessionTranscriptRootDirectory: string | null;
    ownerCallMarker: string | null;
    subAgentOutputRootDirectory: string | null;
    subAgentProcessMatchPattern: string | null;
    subAgentTranscriptRootDirectory: string | null;
    mainSilentThresholdSeconds: number;
    subAgentSilentThresholdSeconds: number;
    subAgentRunningThresholdSeconds: number;
    cooldownSeconds: number;
    staggerSeconds: number;
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