export type SubAgentActivity = {
    label: string;
    silentSeconds: number;
    runningSeconds: number;
};
export type LiveSessionActivitySnapshot = {
    sessionName: string;
    mainSilentSeconds: number | null;
    subAgents: SubAgentActivity[];
    hasUnansweredOwnerCall: boolean;
};
//# sourceMappingURL=LiveSessionActivitySnapshot.d.ts.map