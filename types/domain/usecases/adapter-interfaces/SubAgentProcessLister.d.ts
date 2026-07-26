export type SubAgentProcess = {
    commandLine: string;
    elapsedSeconds: number;
};
export interface SubAgentProcessLister {
    listProcesses: () => Promise<SubAgentProcess[]>;
}
//# sourceMappingURL=SubAgentProcessLister.d.ts.map