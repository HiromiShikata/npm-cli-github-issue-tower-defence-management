"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueRejectionEvaluator = void 0;
class IssueRejectionEvaluator {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.evaluate = async (issue, labelsAsLlmAgentName = [], options = {}) => {
            const rejections = [];
            let approvedPrUrl = null;
            const categoryLabels = issue.labels.filter((label) => label.startsWith('category:'));
            const hasLlmAgentLabel = issue.labels.some((l) => l === 'llm-agent' || l.startsWith('llm-agent:'));
            const hasLabelAsLlmAgentName = issue.labels.some((label) => labelsAsLlmAgentName.includes(label));
            if (!hasLlmAgentLabel &&
                !hasLabelAsLlmAgentName &&
                (categoryLabels.length <= 0 || categoryLabels.includes('category:e2e'))) {
                const prsToCheck = issue.isPr
                    ? await this.resolveOpenPrsForPrItem(issue.url)
                    : options.relatedOpenPrUrls != null
                        ? await this.resolveOpenPrsFromUrls(options.relatedOpenPrUrls)
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
                    if (pr.isDraft) {
                        rejections.push({
                            type: 'PULL_REQUEST_IS_DRAFT',
                            detail: `PULL_REQUEST_IS_DRAFT: ${pr.url}`,
                        });
                    }
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
                    const mustPaths = this.extractChangeTargetMustPaths(issue.labels);
                    if (mustPaths.length > 0) {
                        const changedFilePaths = await this.issueRepository.getPullRequestChangedFilePaths(pr.url);
                        for (const mustPath of mustPaths) {
                            const hasChange = changedFilePaths.some((filePath) => this.isFilePathUnderPath(filePath, mustPath));
                            if (!hasChange) {
                                rejections.push({
                                    type: 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED',
                                    detail: `CHANGE_TARGET_MUST_PATH_NOT_CHANGED: ${mustPath}`,
                                });
                                const firstChangedFile = changedFilePaths.length > 0 ? changedFilePaths[0] : null;
                                const commentBody = `The directory \`${mustPath}\` must contain at least one changed file in this pull request.`;
                                await this.issueRepository.requestChangesWithInlineComment(pr.url, firstChangedFile, commentBody);
                            }
                        }
                    }
                    if (!pr.isDraft &&
                        !pr.isConflicted &&
                        pr.isPassedAllCiJob &&
                        pr.isResolvedAllReviewComments &&
                        rejections.filter((r) => r.type === 'CHANGE_TARGET_MUST_PATH_NOT_CHANGED').length === 0) {
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
        // Resolves the status of each prebuilt related PR URL via getOpenPullRequest,
        // dropping any URL whose PR is not open (getOpenPullRequest returns null).
        // This mirrors findRelatedOpenPRs, which also returns only OPEN pull requests,
        // so the resulting set is equivalent while avoiding the per-issue timeline
        // query. Duplicate URLs are de-duplicated to mirror findRelatedOpenPRs, which
        // collapses duplicates via its internal Map keyed by PR URL.
        this.resolveOpenPrsFromUrls = async (prUrls) => {
            const uniquePrUrls = Array.from(new Set(prUrls));
            const resolvedPrs = [];
            for (const prUrl of uniquePrUrls) {
                const pr = await this.issueRepository.getOpenPullRequest(prUrl);
                if (pr !== null) {
                    resolvedPrs.push(pr);
                }
            }
            return resolvedPrs;
        };
        this.extractChangeTargetMustPaths = (labels) => {
            const prefix = 'change-target-must:';
            const paths = [];
            for (const label of labels) {
                if (!label.startsWith(prefix))
                    continue;
                const raw = label.slice(prefix.length).trim();
                if (raw.length === 0)
                    continue;
                const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '');
                if (normalized.length === 0)
                    continue;
                paths.push(normalized);
            }
            return paths;
        };
        this.isFilePathUnderPath = (filePath, targetPath) => filePath === targetPath || filePath.startsWith(`${targetPath}/`);
    }
}
exports.IssueRejectionEvaluator = IssueRejectionEvaluator;
//# sourceMappingURL=IssueRejectionEvaluator.js.map