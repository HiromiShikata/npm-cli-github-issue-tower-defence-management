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
                let prsToCheck;
                let anyPrResolutionFailed = false;
                if (issue.isPr) {
                    const resolved = await this.resolveOpenPrsForPrItem(issue.url);
                    if (resolved === null) {
                        // getOpenPullRequest failed transiently: the PR's state is unknown
                        // for this cycle, so skip it without emitting any rejection.
                        return { rejections, approvedPrUrl };
                    }
                    prsToCheck = resolved;
                }
                else if (options.relatedOpenPrUrls != null) {
                    const resolved = await this.resolveOpenPrsFromUrls(options.relatedOpenPrUrls);
                    prsToCheck = resolved.prs;
                    anyPrResolutionFailed = resolved.anyResolutionFailed;
                }
                else {
                    prsToCheck = await this.issueRepository.findRelatedOpenPRs(issue.url);
                }
                if (prsToCheck.length <= 0) {
                    if (!anyPrResolutionFailed) {
                        rejections.push({
                            type: 'PULL_REQUEST_NOT_FOUND',
                            detail: 'PULL_REQUEST_NOT_FOUND',
                        });
                    }
                    // When a resolution failed and no PR resolved, the related PR state is
                    // unknown for this cycle; emit no rejection so a transient GraphQL
                    // error cannot cause a false PULL_REQUEST_NOT_FOUND revert.
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
        // Returns null when getOpenPullRequest throws (e.g. a transient GitHub
        // GraphQL server error): the PR's state is unknown for this cycle and the
        // caller skips it instead of letting the error abort the schedule cycle.
        this.resolveOpenPrsForPrItem = async (prUrl) => {
            let pr;
            try {
                pr = await this.issueRepository.getOpenPullRequest(prUrl);
            }
            catch (error) {
                console.warn(`IssueRejectionEvaluator: getOpenPullRequest failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${error instanceof Error ? error.message : String(error)}`);
                return null;
            }
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
        //
        // When getOpenPullRequest throws for a URL (e.g. a transient GitHub GraphQL
        // server error), that PR is logged and skipped for this cycle while the
        // remaining URLs are still resolved; anyResolutionFailed reports whether at
        // least one URL failed so the caller can avoid treating an unknown state as
        // PULL_REQUEST_NOT_FOUND.
        this.resolveOpenPrsFromUrls = async (prUrls) => {
            const uniquePrUrls = Array.from(new Set(prUrls));
            const resolvedPrs = [];
            let anyResolutionFailed = false;
            for (const prUrl of uniquePrUrls) {
                let pr;
                try {
                    pr = await this.issueRepository.getOpenPullRequest(prUrl);
                }
                catch (error) {
                    console.warn(`IssueRejectionEvaluator: getOpenPullRequest failed, skipping PR for this cycle. prUrl: ${prUrl} error: ${error instanceof Error ? error.message : String(error)}`);
                    anyResolutionFailed = true;
                    continue;
                }
                if (pr !== null) {
                    resolvedPrs.push(pr);
                }
            }
            return { prs: resolvedPrs, anyResolutionFailed };
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