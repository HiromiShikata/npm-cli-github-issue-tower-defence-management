import type { Issue } from '../../../domain/entities/Issue';
import type { LocalCommandRunner } from '../../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export type SituationFileParams = {
    cachePath: string;
    projectId: string;
    issues: Issue[];
    statusNames: {
        awaitingQualityCheckStatus: string | null;
        preparationStatus: string | null;
        awaitingWorkspaceStatus: string | null;
        failedPreparationStatus: string | null;
    };
    config: {
        maximumPreparingIssuesCount: number | null;
        utilizationPercentageThreshold: number;
        thresholdForAutoReject: number;
    };
    preparationProcessCheckCommand?: string | null;
    localCommandRunner?: LocalCommandRunner;
};
type MeminfoValues = {
    memTotalKb: number;
    memAvailableKb: number;
    swapTotalKb: number;
    swapFreeKb: number;
};
export declare const parseMeminfo: (meminfo: string) => MeminfoValues;
export declare const writeSituationFile: (params: SituationFileParams) => Promise<void>;
export {};
//# sourceMappingURL=situationFileWriter.d.ts.map