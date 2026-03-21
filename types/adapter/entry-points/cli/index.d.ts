#!/usr/bin/env node
import { Command } from 'commander';
type ConfigFile = {
    projectUrl?: string;
    awaitingWorkspaceStatus?: string;
    preparationStatus?: string;
    defaultAgentName?: string;
    logFilePath?: string;
    maximumPreparingIssuesCount?: number;
    allowIssueCacheMinutes?: number;
    awaitingQualityCheckStatus?: string;
    thresholdForAutoReject?: number;
    workflowBlockerResolvedWebhookUrl?: string;
    projectName?: string;
};
export declare const loadConfigFile: (configFilePath: string) => ConfigFile;
export declare const parseProjectReadmeConfig: (readme: string) => ConfigFile;
export declare const mergeConfigs: (configFile: ConfigFile, cliOverrides: ConfigFile, readmeOverrides: ConfigFile) => ConfigFile;
export declare const fetchProjectReadme: (projectUrl: string, token: string) => Promise<string | null>;
export declare const program: Command;
export {};
//# sourceMappingURL=index.d.ts.map