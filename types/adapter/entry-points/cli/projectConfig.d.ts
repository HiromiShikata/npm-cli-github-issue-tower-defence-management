export type ConfigFile = {
    projectUrl?: string;
    defaultAgentName?: string;
    defaultLlmModelName?: string;
    defaultLlmAgentName?: string;
    maximumPreparingIssuesCount?: number;
    allowIssueCacheMinutes?: number;
    utilizationPercentageThreshold?: number;
    allowedIssueAuthors?: string;
    thresholdForAutoReject?: number;
    workflowBlockerResolvedWebhookUrl?: string;
    projectName?: string;
    preparationProcessCheckCommand?: string;
    codexHomeCandidates?: string[];
    claudeCodeOauthTokenListJsonPath?: string;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
};
export declare const isRecord: (value: unknown) => value is Record<string, unknown>;
export declare const loadConfigFile: (configFilePath: string) => ConfigFile;
export declare const knownProjectReadmeConfigKeys: readonly string[];
export declare const parseProjectReadmeConfig: (readme: string, projectUrl?: string) => ConfigFile;
export declare const mergeConfigs: (configFile: ConfigFile, cliOverrides: ConfigFile, readmeOverrides: ConfigFile) => ConfigFile;
export declare const fetchProjectReadme: (projectUrl: string, token: string) => Promise<string | null>;
//# sourceMappingURL=projectConfig.d.ts.map