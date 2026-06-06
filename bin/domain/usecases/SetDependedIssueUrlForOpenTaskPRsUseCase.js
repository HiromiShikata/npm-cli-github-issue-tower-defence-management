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
            for (const issue of input.issues) {
                if (issue.isPr || issue.isClosed) {
                    continue;
                }
                const relatedOpenPRs = await this.issueRepository.findRelatedOpenPRs(issue.url);
                for (const pr of relatedOpenPRs) {
                    await this.issueRepository.setDependedIssueUrl(pr.url, input.project, issue.url);
                }
            }
        };
    }
}
exports.SetDependedIssueUrlForOpenTaskPRsUseCase = SetDependedIssueUrlForOpenTaskPRsUseCase;
//# sourceMappingURL=SetDependedIssueUrlForOpenTaskPRsUseCase.js.map