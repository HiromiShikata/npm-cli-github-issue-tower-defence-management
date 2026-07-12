export type SubAgentReminderSubAgentSnapshot = {
    label: string;
    lastOutputEpochSeconds: number;
};
export type SubAgentReminderSend = {
    sessionName: string;
    sentEpochSeconds: number;
    subAgents: SubAgentReminderSubAgentSnapshot[];
};
export interface SilentSessionCandidateStateRepository {
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
}
//# sourceMappingURL=SilentSessionCandidateStateRepository.d.ts.map