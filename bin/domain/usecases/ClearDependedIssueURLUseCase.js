"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearDependedIssueURLUseCase = void 0;
class ClearDependedIssueURLUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const dependedIssueUrlSeparatedByComma = input.project.dependedIssueUrlSeparatedByComma;
            if (!dependedIssueUrlSeparatedByComma || input.cacheUsed) {
                return;
            }
            for (const issue of input.issues) {
                if (issue.dependedIssueUrls.length <= 0 || issue.isClosed) {
                    continue;
                }
                const circularDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => {
                    // get all depended issues circularly
                    const circularDependedIssues = new Set();
                    const stack = [dependedIssueUrl];
                    while (stack.length > 0) {
                        const url = stack.pop();
                        if (!url) {
                            throw new Error('url is undefined');
                        }
                        if (circularDependedIssues.has(url)) {
                            continue;
                        }
                        circularDependedIssues.add(url);
                        const dependedIssue = input.issues.find((issue) => issue.url === url);
                        if (!dependedIssue) {
                            continue;
                        }
                        stack.push(...dependedIssue.dependedIssueUrls);
                    }
                    return circularDependedIssues.has(issue.url);
                });
                if (circularDependedIssueUrls.length > 0) {
                    await this.issueRepository.clearProjectField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue);
                    await this.issueRepository.createComment(issue, `Circular dependency removed:
${circularDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                    continue;
                }
                const notFoundDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => !input.issues.some((depIssue) => depIssue.url === dependedIssueUrl));
                const remainingDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => input.issues.some((depIssue) => depIssue.url === dependedIssueUrl && !depIssue.isClosed));
                const closedDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => input.issues.some((depIssue) => depIssue.url === dependedIssueUrl && depIssue.isClosed));
                if (notFoundDependedIssueUrls.length === 0 &&
                    closedDependedIssueUrls.length === 0) {
                    continue;
                }
                if (remainingDependedIssueUrls.length === 0) {
                    await this.issueRepository.clearProjectField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue);
                }
                else {
                    await this.issueRepository.updateProjectTextField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue, remainingDependedIssueUrls.join(','));
                }
                if (closedDependedIssueUrls.length > 0) {
                    const allCleared = remainingDependedIssueUrls.length === 0 &&
                        notFoundDependedIssueUrls.length === 0;
                    await this.issueRepository.createComment(issue, `${allCleared ? 'Closed all depended issues' : 'Closed depended issues'}:
${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                }
                if (notFoundDependedIssueUrls.length > 0) {
                    await this.issueRepository.createComment(issue, `Dependency removed:
${notFoundDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                }
            }
        };
    }
}
exports.ClearDependedIssueURLUseCase = ClearDependedIssueURLUseCase;
//# sourceMappingURL=ClearDependedIssueURLUseCase.js.map