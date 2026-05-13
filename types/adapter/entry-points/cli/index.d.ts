#!/usr/bin/env node
import { Command } from 'commander';
type ConfigFile = {
    projectUrl?: string;
    awaitingWorkspaceStatus?: string;
    preparationStatus?: string;
    defaultAgentName?: string;
    defaultLlmModelName?: string;
    defaultLlmAgentName?: string;
    maximumPreparingIssuesCount?: number;
    allowIssueCacheMinutes?: number;
    utilizationPercentageThreshold?: number;
    allowedIssueAuthors?: string;
    awaitingQualityCheckStatus?: string;
    thresholdForAutoReject?: number;
    workflowBlockerResolvedWebhookUrl?: string;
    projectName?: string;
    preparationProcessCheckCommand?: string;
    codexHomeCandidates?: string[];
    awLogDirectoryPath?: string;
    awLogStaleThresholdMinutes?: number;
    claudeCodeOauthTokenListJsonPath?: string;
};
export declare const loadConfigFile: (configFilePath: string) => ConfigFile;
export declare const parseProjectReadmeConfig: (readme: string) => ConfigFile;
export declare const mergeConfigs: (configFile: ConfigFile, cliOverrides: ConfigFile, readmeOverrides: ConfigFile) => ConfigFile;
export declare const fetchProjectReadme: (projectUrl: string, token: string) => Promise<string | null>;
export declare const program: Command;
export {};
//# sourceMappingURL=index.d.ts.map