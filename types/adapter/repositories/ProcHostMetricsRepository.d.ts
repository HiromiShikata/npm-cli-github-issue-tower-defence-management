export type CpuSample = {
    total: number;
    idle: number;
};
export type LoadAverages = {
    oneMinute: number;
    fiveMinute: number;
    fifteenMinute: number;
};
export type DiskBlocks = {
    blocks: number;
    bfree: number;
    bavail: number;
};
export declare const parseMemoryUsedPercent: (meminfoText: string) => number;
export declare const parseCpuSample: (statText: string) => CpuSample;
export declare const cpuUsedPercentFromSamples: (first: CpuSample, second: CpuSample) => number;
export declare const parseDiskUsedPercent: (blocks: number, bfree: number, bavail: number) => number;
export declare const parseLoadAverages: (loadavgText: string) => LoadAverages;
export declare const cycleMinutesFromFetchTimestamps: (previousFetchedAtIso: string | null, currentFetchedAtIso: string | null) => number | null;
export declare class ProcHostMetricsRepository {
    private readonly procDirectory;
    private readonly sleep;
    private readonly readDiskBlocks;
    private readonly rootPath;
    constructor(procDirectory?: string, sleep?: (milliseconds: number) => Promise<void>, readDiskBlocks?: (rootPath: string) => DiskBlocks, rootPath?: string);
    readMemoryUsedPercent: () => number;
    readCpuUsedPercent: () => Promise<number>;
    readLoadAverages: () => LoadAverages;
    readDiskUsedPercent: () => number;
}
//# sourceMappingURL=ProcHostMetricsRepository.d.ts.map