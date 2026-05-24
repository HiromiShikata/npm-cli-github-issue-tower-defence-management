import type { RotationOrderEntry } from '../../../domain/usecases/StartPreparationUseCase';
export type RotationOrderFileEntry = {
    name: string;
    fiveHourUtilization: number;
    blocked: boolean;
    rejected: boolean;
    thresholdExcluded: boolean;
};
export declare const writeRotationOrderFile: (rotationOrder: RotationOrderEntry[]) => void;
//# sourceMappingURL=rotationOrderFileWriter.d.ts.map