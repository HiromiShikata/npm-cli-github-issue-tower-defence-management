"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeTargetPullRequestApprover = void 0;
class ChangeTargetPullRequestApprover {
    constructor(issueRepository) {
        this.issueRepository = issueRepository;
        this.approveIfConfined = async (issueLabels, approvedPrUrl, pathAliases) => {
            if (approvedPrUrl === null) {
                return;
            }
            const changeTargetPaths = this.extractChangeTargetPaths(issueLabels, pathAliases);
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
        this.extractChangeTargetPaths = (labels, pathAliases) => {
            const prefixes = ['change-target:', 'change-target-must:'];
            const paths = [];
            for (const label of labels) {
                const matchedPrefix = prefixes.find((p) => label.startsWith(p));
                if (!matchedPrefix)
                    continue;
                const raw = label.slice(matchedPrefix.length).trim();
                if (raw.length === 0)
                    continue;
                const normalized = raw.replace(/^\/+/, '').replace(/\/+$/, '');
                if (normalized.length === 0)
                    continue;
                const aliasExpanded = pathAliases?.[normalized] ?? normalized;
                const finalPath = aliasExpanded.replace(/^\/+/, '').replace(/\/+$/, '');
                if (finalPath.length === 0)
                    continue;
                paths.push(finalPath);
            }
            return paths;
        };
        this.isFilePathConfinedToAllowedPaths = (filePath, allowedPaths) => allowedPaths.some((allowedPath) => filePath === allowedPath || filePath.startsWith(`${allowedPath}/`));
    }
}
exports.ChangeTargetPullRequestApprover = ChangeTargetPullRequestApprover;
//# sourceMappingURL=ChangeTargetPullRequestApprover.js.map