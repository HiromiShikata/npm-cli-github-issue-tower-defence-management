import { LiveSessionOauthTokenSelectionSettings } from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
export declare const FLEET_CONFIG_FILE_PATH_ENVIRONMENT_VARIABLE = "TDPM_FLEET_CONFIG";
export declare const LIVE_SESSION_OAUTH_TOKEN_SELECTION_SECTION_KEY = "liveSessionOauthTokenSelection";
export declare const resolveFleetConfigFilePath: (cliValue: string | null) => string | null;
export declare const loadLiveSessionOauthTokenSelectionSettings: (fleetConfigFilePath: string | null) => LiveSessionOauthTokenSelectionSettings;
//# sourceMappingURL=fleetConfig.d.ts.map