export type SubAgentActivity = {
    label: string;
    silentSeconds: number;
    runningSeconds: number;
    waitingOnExternalProcess: boolean;
};
export type LiveSessionActivitySnapshot = {
    sessionName: string;
    mainSilentSeconds: number | null;
    subAgents: SubAgentActivity[];
    hasUnansweredOwnerCall: boolean;
};
//# sourceMappingURL=LiveSessionActivitySnapshot.d.ts.map