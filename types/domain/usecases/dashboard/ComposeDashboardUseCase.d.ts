import { DashboardRow } from './GenerateDashboardRowUseCase';
import { TokenStatus } from './GenerateTokenStatusUseCase';
export declare const PROJECT_ROW_WIDTH_BUDGET = 32;
export type ComposeDashboardProject = {
    code: string;
    row: DashboardRow | null;
};
export type ComposeDashboardMachineStatus = {
    memPct: number | null;
    cpuPct: number | null;
    diskPct: number | null;
    load: [number, number, number] | null;
    cycleMinutes: number | null;
};
export type ComposeDashboardInput = {
    projects: ComposeDashboardProject[];
    machineStatus: ComposeDashboardMachineStatus | null;
    tokens: TokenStatus[];
};
export declare const roundHalfToEven: (value: number) => number;
export declare const formatResetCountdown: (totalSeconds: number) => string;
export declare const formatMachineStatusLines: (machineStatus: ComposeDashboardMachineStatus | null) => [string, string];
export declare const formatProjectHeaderLine: () => string;
export declare const formatProjectRowLine: (project: ComposeDashboardProject) => string;
export declare const formatTokenRowLine: (token: TokenStatus) => string;
export declare class ComposeDashboardUseCase {
    run: (input: ComposeDashboardInput) => string;
}
//# sourceMappingURL=ComposeDashboardUseCase.d.ts.map