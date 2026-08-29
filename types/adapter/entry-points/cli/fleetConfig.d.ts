import { LiveSessionOauthTokenSelectionSettings } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
export declare const FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = "TDPM_FLEET_CONFIG";
export declare const LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = "liveSessionOauthTokenSelection";
export declare const PREPARATION_WORKER_SECTION_KEY = "preparationWorker";
export type PreparationWorkerSettings = {
    normalConcurrentLimit: number;
};
export declare const DEFAULT_PREPARATION_WORKER_SETTINGS: PreparationWorkerSettings;
export declare const resolveFleetConfigFilePath: (cliValue: string | null) => string | null;
export declare const loadLiveSessionOauthTokenSelectionSettings: (fleetConfigFilePath: string | null) => LiveSessionOauthTokenSelectionSettings;
export declare const loadPreparationWorkerSettings: (fleetConfigFilePath: string | null) => PreparationWorkerSettings;
//# sourceMappingURL=fleetConfig.d.ts.map