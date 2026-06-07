"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckIssueReviewReadinessUseCase = void 0;
const IssueRejectionEvaluator_1 = require("./IssueRejectionEvaluator");
const NotifyFinishedIssuePreparationUseCase_1 = require("./NotifyFinishedIssuePreparationUseCase");
class CheckIssueReviewReadinessUseCase {
    constructor(projectRepository, issueRepository) {
        this.projectRepository = projectRepository;
        this.issueRepository = issueRepository;
        this.run = async (params) => {
            const project = await this.projectRepository.getByUrl(params.projectUrl);
            const issue = await this.issueRepository.get(params.issueUrl, project);
            if (!issue) {
                throw new NotifyFinishedIssuePreparationUseCase_1.IssueNotFoundError(params.issueUrl);
            }
            const { rejections } = await this.issueRejectionEvaluator.evaluate(issue, params.labelsAsLlmAgentName ?? []);
            return {
                reviewReady: rejections.length === 0,
                rejections,
            };
        };
        this.issueRejectionEvaluator = new IssueRejectionEvaluator_1.IssueRejectionEvaluator(issueRepository);
    }
}
exports.CheckIssueReviewReadinessUseCase = CheckIssueReviewReadinessUseCase;
//# sourceMappingURL=CheckIssueReviewReadinessUseCase.js.map