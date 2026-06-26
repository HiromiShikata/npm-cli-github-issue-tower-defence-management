import { Issue } from '../../entities/Issue';
export type DashboardRow = {
    unread: number;
    todo: number;
    qc: number;
    fail: number;
    pr: number;
    ws: number;
    dep: number;
    blocker: number;
};
export type GenerateDashboardRowInput = {
    issues: Issue[];
    assigneeLogin: string;
};
export declare class GenerateDashboardRowUseCase {
    run: (input: GenerateDashboardRowInput) => DashboardRow;
}
//# sourceMappingURL=GenerateDashboardRowUseCase.d.ts.map