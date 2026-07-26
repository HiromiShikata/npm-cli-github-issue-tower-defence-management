import { DiskConfig } from '../cli/projectConfig';
import { ProcHostMetricsRepository } from '../../repositories/ProcHostMetricsRepository';
export type MachineStatusWriterParams = {
    dashboardDataDir: string | null | undefined;
    allIssuesCacheDir: string | null | undefined;
    disks?: DiskConfig[] | null;
    hostMetricsRepository?: ProcHostMetricsRepository;
    now?: Date;
};
export type MachineStatusDisk = {
    title: string;
    pct: number;
};
export type MachineStatusFile = {
    memPct: number;
    cpuPct: number;
    diskPct: number;
    disks?: MachineStatusDisk[];
    load: [number, number, number];
    cycleMinutes: number | null;
    lastFetchedAt: string | null;
    capturedAt: string;
};
export declare const writeMachineStatus: (params: MachineStatusWriterParams) => Promise<void>;
//# sourceMappingURL=machineStatusWriter.d.ts.map