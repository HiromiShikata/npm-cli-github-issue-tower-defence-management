export type ConfigFile = {
    projectUrl?: string;
    manager?: string;
    defaultAgentName?: string;
    defaultLlmModelName?: string;
    fallbackLlmModelName?: string;
    defaultLlmAgentName?: string;
    maximumPreparingIssuesCount?: number;
    utilizationPercentageThreshold?: number;
    allowedIssueAuthors?: string;
    autoAssignManagerAuthors?: string;
    thresholdForAutoReject?: number;
    workflowBlockerResolvedWebhookUrl?: string;
    projectName?: string;
    preparationProcessCheckCommand?: string;
    codexHomeCandidates?: string[];
    claudeCodeOauthTokenListJsonPath?: string;
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
    labelsAsLlmAgentName?: string[];
    labelsNotRequiringPullRequest?: string[];
    changeTargetPathAliases?: Record<string, string>;
    agents?: string[];
    consoleDataOutputDir?: string;
    consoleAccessToken?: string;
    consoleProjects?: Record<string, string>;
    consoleGithubTokenFilesByRepositoryOwner?: Record<string, string>;
    disks?: DiskConfig[];
};
export type DiskConfig = {
    title: string;
    mountpoint: string;
};
export declare const isRecord: (value: unknown) => value is Record<string, unknown>;
export declare const loadConfigFile: (configFilePath: string) => ConfigFile;
export declare const parseProjectReadmeConfig: (readme: string, projectUrl?: string) => ConfigFile;
export declare const mergeConfigs: (configFile: ConfigFile, cliOverrides: ConfigFile, readmeOverrides: ConfigFile) => ConfigFile;
export declare const fetchProjectReadme: (projectUrl: string, token: string) => Promise<string | null>;
//# sourceMappingURL=projectConfig.d.ts.map