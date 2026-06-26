import type { Issue } from '../../../domain/entities/Issue';
import { DashboardRow } from '../../../domain/usecases/dashboard/GenerateDashboardRowUseCase';
export type DashboardRowWriterParams = {
    dashboardDataDir: string | null | undefined;
    pjcode: string | null | undefined;
    assigneeLogin: string | null | undefined;
    issues: Issue[];
    generatedAt?: string;
};
export type DashboardRowFile = DashboardRow & {
    pjcode: string;
    capturedAt: string;
};
export declare const writeDashboardRow: (params: DashboardRowWriterParams) => void;
//# sourceMappingURL=dashboardRowWriter.d.ts.map