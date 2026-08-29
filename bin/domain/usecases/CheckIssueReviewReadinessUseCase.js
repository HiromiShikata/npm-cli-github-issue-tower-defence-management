"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIssueReviewReadinessUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const resolveLabelsNotRequiringPullRequest_1 = require("./resolveLabelsNotRequiringPullRequest");
const isPullRequestDeclaredUnnecessary_1 = require("./isPullRequestDeclaredUnnecessary");
const normalizeReportBody_1 = require("./normalizeReportBody");
const isAgentReportBody_1 = require("./isAgentReportBody");
const isAuthorAuthorizedForAutoStatusCheck_1 = require("./isAuthorAuthorizedForAutoStatusCheck");
class CheckIssueReviewReadinessUseCase {
    constructor(issueRepository, issueCommentRepository) {
        this.issueRepository = issueRepository;
        this.issueCommentRepository = issueCommentRepository;
        this.run = async (params) => {
            const issue = await this.issueRepository.getIssueByUrl(params.issueUrl);
            if (!issue) {
                return {
                    reviewReady: false,
                    rejections: [
                        {
                            type: 'ISSUE_NOT_FOUND',
                            detail: `Issue not found: ${params.issueUrl}`,
                        },
                    ],
                };
            }
            const rejections = [];
            const comments = await this.issueCommentRepository.getCommentsFromIssue(issue);
            const isTrustedAuthor = (author) => (0, isAuthorAuthorizedForAutoStatusCheck_1.isAuthorAuthorizedForAutoStatusCheck)(author, params.allowedIssueAuthors);
            const lastComment = comments[comments.length - 1];
            if (!lastComment ||
                !isTrustedAuthor(lastComment.author) ||
                !(0, isAgentReportBody_1.isAgentReportBody)(lastComment.content)) {
                rejections.push({
                    type: 'NO_REPORT_FROM_AGENT_BOT',
                    detail: 'NO_REPORT_FROM_AGENT_BOT',
                });
            }
            else if (this.reportBodyHasNextStep(lastComment.content)) {
                rejections.push({
                    type: 'REPORT_HAS_NEXT_STEP',
                    detail: 'REPORT_HAS_NEXT_STEP',
                });
            }
            const { rejections: prRejections } = await this.issueRejectionEvaluator.evaluate(issue, (0, resolveLabelsNotRequiringPullRequest_1.resolveLabelsNotRequiringPullRequest)(params), { developerAgentName: params.developerAgentName });
            const requiredPrRejections = (0, isPullRequestDeclaredUnnecessary_1.isPullRequestDeclaredUnnecessary)(comments, isTrustedAuthor)
                ? prRejections.filter((rejection) => rejection.type !== 'PULL_REQUEST_NOT_FOUND')
                : prRejections;
            const allRejections = [...rejections, ...requiredPrRejections];
            return {
                reviewReady: allRejections.length === 0,
                rejections: allRejections,
            };
        };
        this.reportBodyHasNextStep = (body) => {
            const reportMatch = (0, normalizeReportBody_1.normalizeReportBody)(body).match(/```json\n([\s\S]*?)\n```/);
            if (!reportMatch || reportMatch.length < 2) {
                return false;
            }
            let reportJson;
            try {
                reportJson = JSON.parse(reportMatch[1]);
            }
            catch (error) {
                console.warn('Invalid JSON in report body while checking nextStep:', error);
                return false;
            }
            if (typeof reportJson !== 'object' || reportJson === null) {
                return false;
            }
            if (!('nextStep' in reportJson)) {
                return false;
            }
            const nextStepValue = Reflect.get(reportJson, 'nextStep');
            return nextStepValue !== null && nextStepValue !== undefined;
        };
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
    }
}
exports.CheckIssueReviewReadinessUseCase = CheckIssueReviewReadinessUseCase;
//# sourceMappingURL=CheckIssueReviewReadinessUseCase.js.map