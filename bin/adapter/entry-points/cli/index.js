#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const HandleScheduledEventUseCaseHandler_1 = require("../handlers/HandleScheduledEventUseCaseHandler");
const program = new commander_1.Command();
program
    .name('github-issue-tower-defence-management')
    .description('CLI tool for GitHub Issue Tower Defence Management')
    .requiredOption('-t, --trigger <type>', 'Trigger type: issue or schedule', /^(issue|schedule)$/i)
    .requiredOption('-c, --config <path>', 'Path to config YAML file')
    .option('-v, --verbose', 'Verbose output')
    .option('-i, --issue <url>', 'GitHub Issue URL')
    .action(async (options) => {
    if (options.trigger === 'issue' && !options.issue) {
        console.error('Issue URL is required when trigger type is "issue"');
        process.exit(1);
    }
    if (options.trigger === 'schedule') {
        const handler = new HandleScheduledEventUseCaseHandler_1.HandleScheduledEventUseCaseHandler();
        await handler.handle(options.config, options.verbose);
    }
});
if (process.argv) {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map