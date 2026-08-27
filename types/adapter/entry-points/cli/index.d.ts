#!/usr/bin/env node
import { Command } from 'commander';
export { ConfigFile, fetchProjectReadme, loadConfigFile, mergeConfigs, parseProjectReadmeConfig, } from './projectConfig';
export declare const program: Command;
export declare const reportFatalErrorAndExit: (error: unknown) => void;
export declare const runCliProgram: (argv: string[], handleFatalError: (error: unknown) => void) => Promise<void>;
//# sourceMappingURL=index.d.ts.map