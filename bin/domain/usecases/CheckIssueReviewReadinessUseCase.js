"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIssueReviewReadinessUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
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
            const isTrustedAuthor = (author) => this.isAuthorTrusted(author, params.allowedIssueAuthors ?? null);
            const lastComment = comments[comments.length - 1];
            if (!lastComment ||
                !isTrustedAuthor(lastComment.author) ||
                !lastComment.content.startsWith('From: :robot:')) {
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
            const { rejections: prRejections } = await this.issueRejectionEvaluator.evaluate(issue, params.labelsAsLlmAgentName ?? []);
            const allRejections = [...rejections, ...prRejections];
            return {
                reviewReady: allRejections.length === 0,
                rejections: allRejections,
            };
        };
        this.isAuthorTrusted = (author, allowedIssueAuthors) => allowedIssueAuthors === null || allowedIssueAuthors.includes(author);
        this.reportBodyHasNextStep = (body) => {
            const reportMatch = body.match(/```json\n([\s\S]*?)\n```/);
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