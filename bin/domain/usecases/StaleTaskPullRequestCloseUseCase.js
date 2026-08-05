"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaleTaskPullRequestCloseUseCase = void 0;
class StaleTaskPullRequestCloseUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const closedTaskIssueUrls = new Set(input.issues
                .filter((issue) => !issue.isPr && issue.isClosed)
                .map((issue) => issue.url));
            for (const issue of input.issues) {
                if (!issue.isPr || issue.isClosed) {
                    continue;
                }
                if (issue.closingIssueReferenceUrls.length === 0) {
                    continue;
                }
                const everyReferencedTaskIssueClosed = issue.closingIssueReferenceUrls.every((url) => closedTaskIssueUrls.has(url));
                if (!everyReferencedTaskIssueClosed) {
                    continue;
                }
                try {
                    await this.issueRepository.closePullRequest(issue.url);
                }
                catch (error) {
                    console.warn(`Failed to close stale pull request ${issue.url}, skipping and continuing with remaining pull requests: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        };
    }
}
exports.StaleTaskPullRequestCloseUseCase = StaleTaskPullRequestCloseUseCase;
//# sourceMappingURL=StaleTaskPullRequestCloseUseCase.js.map