"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetDependedIssueUrlForOpenTaskPRsUseCase = void 0;
class SetDependedIssueUrlForOpenTaskPRsUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            if (!input.project.dependedIssueUrlSeparatedByComma) {
                console.warn(`dependedIssueUrlSeparatedByComma field not configured in project, skipping SetDependedIssueUrlForOpenTaskPRsUseCase`);
                return;
            }
            const openPrUrlsByClosedIssueUrl = this.buildOpenPrUrlsByClosedIssueUrl(input.issues);
            for (const issue of input.issues) {
                if (issue.isPr || issue.isClosed) {
                    continue;
                }
                const relatedOpenPrUrls = openPrUrlsByClosedIssueUrl.get(issue.url);
                if (!relatedOpenPrUrls) {
                    continue;
                }
                for (const prUrl of relatedOpenPrUrls) {
                    try {
                        await this.issueRepository.setDependedIssueUrl(prUrl, input.project, issue.url);
                    }
                    catch (error) {
                        console.warn(`Failed to set depended issue URL for PR ${prUrl}, skipping and continuing with remaining PRs: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }
        };
        this.buildOpenPrUrlsByClosedIssueUrl = (issues) => {
            const openPrUrlsByClosedIssueUrl = new Map();
            for (const issue of issues) {
                if (!issue.isPr || issue.isClosed) {
                    continue;
                }
                for (const closedIssueUrl of issue.closingIssueReferenceUrls) {
                    const existing = openPrUrlsByClosedIssueUrl.get(closedIssueUrl);
                    if (existing) {
                        existing.add(issue.url);
                    }
                    else {
                        openPrUrlsByClosedIssueUrl.set(closedIssueUrl, new Set([issue.url]));
                    }
                }
            }
            const result = new Map();
            for (const [closedIssueUrl, prUrls] of openPrUrlsByClosedIssueUrl) {
                result.set(closedIssueUrl, Array.from(prUrls));
            }
            return result;
        };
    }
}
exports.SetDependedIssueUrlForOpenTaskPRsUseCase = SetDependedIssueUrlForOpenTaskPRsUseCase;
//# sourceMappingURL=SetDependedIssueUrlForOpenTaskPRsUseCase.js.map