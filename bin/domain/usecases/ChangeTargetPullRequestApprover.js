"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeTargetPullRequestApprover = void 0;
class ChangeTargetPullRequestApprover {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.approveIfConfined = async (issueLabels, approvedPrUrl) => {
            if (approvedPrUrl === null) {
                return;
            }
            const changeTargetPaths = this.extractChangeTargetPaths(issueLabels);
            if (changeTargetPaths.length === 0) {
                return;
            }
            const changedFilePaths = await this.issueRepository.getPullRequestChangedFilePaths(approvedPrUrl);
            if (changedFilePaths.length === 0) {
                return;
            }
            const allConfined = changedFilePaths.every((filePath) => this.isFilePathConfinedToAllowedPaths(filePath, changeTargetPaths));
            if (!allConfined) {
                return;
            }
            await this.issueRepository.approvePullRequest(approvedPrUrl);
        };
        this.extractChangeTargetPaths = (labels) => {
            const prefix = 'change-target:';
            const paths = [];
            for (const label of labels) {
                if (!label.startsWith(prefix))
                    continue;
                const raw = label.slice(prefix.length).trim();
                if (raw.length === 0)
                    continue;
                const normalized = raw.replace(/\/+$/, '');
                if (normalized.length === 0)
                    continue;
                paths.push(normalized);
            }
            return paths;
        };
        this.isFilePathConfinedToAllowedPaths = (filePath, allowedPaths) => allowedPaths.some((allowedPath) => filePath === allowedPath || filePath.startsWith(`${allowedPath}/`));
    }
}
exports.ChangeTargetPullRequestApprover = ChangeTargetPullRequestApprover;
//# sourceMappingURL=ChangeTargetPullRequestApprover.js.map