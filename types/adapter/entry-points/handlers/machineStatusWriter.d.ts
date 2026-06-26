import { ProcHostMetricsRepository } from '../../repositories/ProcHostMetricsRepository';
export type MachineStatusWriterParams = {
    dashboardDataDir: string | null | undefined;
    allIssuesCacheDir: string | null | undefined;
    hostMetricsRepository?: ProcHostMetricsRepository;
    now?: Date;
};
export type MachineStatusFile = {
    memPct: number;
    cpuPct: number;
    load: [number, number, number];
    cycleMinutes: number | null;
    capturedAt: string;
};
export declare const writeMachineStatus: (params: MachineStatusWriterParams) => Promise<void>;
//# sourceMappingURL=machineStatusWriter.d.ts.map