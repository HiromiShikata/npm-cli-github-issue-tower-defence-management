"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeStatusLongInReviewIssueUseCase = void 0;
class ChangeStatusLongInReviewIssueUseCase {
    constructor(dateRepository, issueRepository) {
        this.dateRepository = dateRepository;
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const firstStatus = input.project.status.statuses[0];
            if (!firstStatus) {
                throw new Error('First status is not found');
            }
            for (const issue of input.issues) {
                if (issue.isPr ||
                    issue.isClosed ||
                    !issue.status?.toLowerCase().includes('review')) {
                    continue;
                }
                if (issue.workingTimeline.length > 0) {
                    const latestWorkingTime = issue.workingTimeline[issue.workingTimeline.length - 1];
                    const now = await this.dateRepository.now();
                    const diff = now.getTime() - latestWorkingTime.endedAt.getTime();
                    const diffHours = diff / (1000 * 60 * 60);
                    if (diffHours < 48) {
                        continue;
                    }
                }
                await this.issueRepository.createComment(issue, `${issue.assignees.map((assignee) => `@${assignee}`).join(' ')}
This issue has been in review for more than 48 hours.
Please check the situation of PR again :pray:`);
                await this.issueRepository.updateStatus(input.project, issue, firstStatus.id);
            }
        };
    }
}
exports.ChangeStatusLongInReviewIssueUseCase = ChangeStatusLongInReviewIssueUseCase;
//# sourceMappingURL=ChangeStatusLongInReviewIssueUseCase.js.map