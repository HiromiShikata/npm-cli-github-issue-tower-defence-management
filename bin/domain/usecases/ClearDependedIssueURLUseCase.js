"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClearDependedIssueURLUseCase = void 0;
class ClearDependedIssueURLUseCase {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.run = async (input) => {
            const dependedIssueUrlSeparatedByComma = input.project.dependedIssueUrlSeparatedByComma;
            if (!dependedIssueUrlSeparatedByComma) {
                return;
            }
            const absentDependedIssueIsResolvable = !input.cacheUsed;
            for (const issue of input.issues) {
                if (issue.dependedIssueUrls.length <= 0 || issue.isClosed) {
                    continue;
                }
                const circularDependedIssueUrls = absentDependedIssueIsResolvable
                    ? this.findCircularDependedIssueUrls(issue, input.issues)
                    : [];
                if (circularDependedIssueUrls.length > 0) {
                    await this.issueRepository.clearProjectField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue);
                    await this.issueRepository.createComment(issue, `Circular dependency removed:
${circularDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                    continue;
                }
                const notFoundDependedIssueUrls = absentDependedIssueIsResolvable
                    ? issue.dependedIssueUrls.filter((dependedIssueUrl) => !input.issues.some((depIssue) => depIssue.url === dependedIssueUrl))
                    : [];
                const openDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => input.issues.some((depIssue) => depIssue.url === dependedIssueUrl && !depIssue.isClosed));
                const closedDependedIssueUrls = issue.dependedIssueUrls.filter((dependedIssueUrl) => input.issues.some((depIssue) => depIssue.url === dependedIssueUrl && depIssue.isClosed));
                if (notFoundDependedIssueUrls.length === 0 &&
                    closedDependedIssueUrls.length === 0) {
                    continue;
                }
                const remainingDependedIssueUrls = absentDependedIssueIsResolvable
                    ? openDependedIssueUrls
                    : issue.dependedIssueUrls.filter((dependedIssueUrl) => !closedDependedIssueUrls.includes(dependedIssueUrl));
                if (remainingDependedIssueUrls.length === 0) {
                    await this.issueRepository.clearProjectField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue);
                }
                else {
                    await this.issueRepository.updateProjectTextField(input.project, dependedIssueUrlSeparatedByComma.fieldId, issue, remainingDependedIssueUrls.join(','));
                }
                if (closedDependedIssueUrls.length > 0) {
                    const allCleared = remainingDependedIssueUrls.length === 0 &&
                        notFoundDependedIssueUrls.length === 0;
                    await this.issueRepository.createComment(issue, `${allCleared ? 'All depended issues are already closed, dependency field cleared' : 'Some depended issues are already closed, removed from dependency field'}:
${closedDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                }
                if (notFoundDependedIssueUrls.length > 0) {
                    await this.issueRepository.createComment(issue, `Dependency removed:
${notFoundDependedIssueUrls.map((url) => `- ${url}`).join('\n')}`);
                }
            }
        };
        this.findCircularDependedIssueUrls = (issue, issues) => issue.dependedIssueUrls.filter((dependedIssueUrl) => {
            const reachableIssueUrls = new Set();
            const stack = [dependedIssueUrl];
            while (stack.length > 0) {
                const url = stack.pop();
                if (!url) {
                    throw new Error('url is undefined');
                }
                if (reachableIssueUrls.has(url)) {
                    continue;
                }
                reachableIssueUrls.add(url);
                const dependedIssue = issues.find((candidate) => candidate.url === url);
                if (!dependedIssue) {
                    continue;
                }
                stack.push(...dependedIssue.dependedIssueUrls);
            }
            return reachableIssueUrls.has(issue.url);
        });
    }
}
exports.ClearDependedIssueURLUseCase = ClearDependedIssueURLUseCase;
//# sourceMappingURL=ClearDependedIssueURLUseCase.js.map