"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueRejectionEvaluator = void 0;
class IssueRejectionEvaluator {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.evaluate = async (issue) => {
            const rejections = [];
            let approvedPrUrl = null;
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            const hasLlmAgentLabel = issue.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
            if (!hasLlmAgentLabel &&
                (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e'))) {
                const prsToCheck = issue.isPr
                    ? await this.resolveOpenPrsForPrItem(issue.url)
                    : await this.issueRepository.findRelatedOpenPRs(issue.url);
                if (prsToCheck.length <= 0) {
                    rejections.push({
                        type: 'PULL_REQUEST_NOT_FOUND',
                        detail: 'PULL_REQUEST_NOT_FOUND',
                    });
                }
                else if (prsToCheck.length > 1) {
                    rejections.push({
                        type: 'MULTIPLE_PULL_REQUESTS_FOUND',
                        detail: `MULTIPLE_PULL_REQUESTS_FOUND: ${prsToCheck.map((pr) => pr.url).join(', ')}`,
                    });
                }
                else {
                    const pr = prsToCheck[0];
                    if (pr.isConflicted) {
                        rejections.push({
                            type: 'PULL_REQUEST_CONFLICTED',
                            detail: `PULL_REQUEST_CONFLICTED: ${pr.url}`,
                        });
                    }
                    if (!pr.isPassedAllCiJob) {
                        const missingChecks = pr.missingRequiredCheckNames;
                        const missingSuffix = missingChecks.length > 0
                            ? ` (missing: ${missingChecks.join(', ')})`
                            : '';
                        if (pr.isCiStateSuccess && missingChecks.length > 0) {
                            rejections.push({
                                type: 'REQUIRED_CI_JOB_NEVER_STARTED',
                                detail: `REQUIRED_CI_JOB_NEVER_STARTED: ${pr.url}${missingSuffix}`,
                            });
                        }
                        else {
                            rejections.push({
                                type: 'ANY_CI_JOB_FAILED_OR_IN_PROGRESS',
                                detail: `ANY_CI_JOB_FAILED_OR_IN_PROGRESS: ${pr.url}${missingSuffix}`,
                            });
                        }
                    }
                    if (!pr.isResolvedAllReviewComments) {
                        rejections.push({
                            type: 'ANY_REVIEW_COMMENT_NOT_RESOLVED',
                            detail: `ANY_REVIEW_COMMENT_NOT_RESOLVED: ${pr.url}`,
                        });
                    }
                    if (!pr.isConflicted &&
                        pr.isPassedAllCiJob &&
                        pr.isResolvedAllReviewComments) {
                        approvedPrUrl = pr.url;
                    }
                }
            }
            return { rejections, approvedPrUrl };
        };
        this.resolveOpenPrsForPrItem = async (prUrl) => {
            const pr = await this.issueRepository.getOpenPullRequest(prUrl);
            if (pr === null) {
                return [];
            }
            return [pr];
        };
    }
}
exports.IssueRejectionEvaluator = IssueRejectionEvaluator;
//# sourceMappingURL=IssueRejectionEvaluator.js.map