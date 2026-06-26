import { ComposeDashboardInput } from '../../../domain/usecases/dashboard/ComposeDashboardUseCase';
export type DashboardComposeOptions = {
    dashboardDataDir: string;
    projectCodes: string[];
};
export declare const buildComposeDashboardInput: (options: DashboardComposeOptions) => ComposeDashboardInput;
export declare const composeDashboardText: (options: DashboardComposeOptions) => string;
//# sourceMappingURL=dashboardComposeService.d.ts.map