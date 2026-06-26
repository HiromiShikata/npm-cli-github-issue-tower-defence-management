export type CpuSample = {
    total: number;
    idle: number;
};
export type LoadAverages = {
    oneMinute: number;
    fiveMinute: number;
    fifteenMinute: number;
};
export declare const parseMemoryUsedPercent: (meminfoText: string) => number;
export declare const parseCpuSample: (statText: string) => CpuSample;
export declare const cpuUsedPercentFromSamples: (first: CpuSample, second: CpuSample) => number;
export declare const parseLoadAverages: (loadavgText: string) => LoadAverages;
export declare const cycleMinutesFromMtimes: (mtimesDescendingSeconds: number[]) => number | null;
export declare class ProcHostMetricsRepository {
    private readonly procDirectory;
    private readonly sleep;
    constructor(procDirectory?: string, sleep?: (milliseconds: number) => Promise<void>);
    readMemoryUsedPercent: () => number;
    readCpuUsedPercent: () => Promise<number>;
    readLoadAverages: () => LoadAverages;
}
//# sourceMappingURL=ProcHostMetricsRepository.d.ts.map