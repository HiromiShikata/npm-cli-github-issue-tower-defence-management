import { SilentSessionCandidateStateRepository, SubAgentReminderSend, SubAgentReminderSubAgentSnapshot } from '../../domain/usecases/adapter-interfaces/SilentSessionCandidateStateRepository';
export declare const DEFAULT_STATE_RETENTION_WINDOW_SECONDS: number;
export declare const SUBAGENT_REMINDER_SEND_RETENTION_WINDOW_SECONDS: number;
export declare class FileSystemSilentSessionCandidateStateRepository implements SilentSessionCandidateStateRepository {
    private readonly stateFilePath;
    private readonly retentionWindowSeconds;
    constructor(stateFilePath?: string, retentionWindowSeconds?: number);
    loadRecentCandidateSessionNames: (params: {
        now: Date;
        recencyWindowSeconds: number;
    }) => Promise<Set<string>>;
    saveCandidateSessionNames: (params: {
        sessionNames: string[];
        now: Date;
    }) => Promise<void>;
    loadSubAgentReminderSend: (params: {
        sessionName: string;
    }) => Promise<SubAgentReminderSend | null>;
    saveSubAgentReminderSend: (params: {
        sessionName: string;
        subAgents: SubAgentReminderSubAgentSnapshot[];
        now: Date;
    }) => Promise<void>;
    private readState;
    private readCandidateEntries;
    private readSubAgentReminderSendEntries;
    private writeState;
}
//# sourceMappingURL=FileSystemSilentSessionCandidateStateRepository.d.ts.map