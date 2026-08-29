"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliErrorReportUseCase = void 0;
class CliErrorReportUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            const { error, owner, repo, commandLine } = params;
            const errorName = error instanceof Error ? (error.name ?? 'Error') : 'Error';
            const message = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error && error.stack ? error.stack : String(error);
            const title = `CLI error: ${errorName}: ${message.slice(0, 80)}`;
            const occurredAt = new Date().toISOString();
            const buildBody = (prefix) => [
                `${prefix}`,
                ``,
                `Error name: ${errorName}`,
                `Message: ${message}`,
                `Command: \`${commandLine}\``,
                `Occurred at: ${occurredAt}`,
                ``,
                `Stack trace:`,
                `\`\`\``,
                stack,
                `\`\`\``,
            ].join('\n');
            try {
                const results = await this.issueRepository.searchIssue({
                    owner,
                    repositoryName: repo,
                    type: 'issue',
                    state: 'open',
                    title,
                });
                const existing = results.find((r) => r.title === title);
                if (existing) {
                    await this.issueRepository.createCommentByUrl(existing.url, buildBody('CLI error recurrence'));
                }
                else {
                    await this.issueRepository.createNewIssue(owner, repo, title, buildBody('CLI error report'), [], []);
                }
            }
            catch (reportError) {
                console.error('CliErrorReportUseCase: failed to report error:', reportError);
            }
        };
    }
}
exports.CliErrorReportUseCase = CliErrorReportUseCase;
//# sourceMappingURL=CliErrorReportUseCase.js.map