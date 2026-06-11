"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrReviewViewerServerStartUseCase = void 0;
class PrReviewViewerServerStartUseCase {
    constructor(prReviewViewerListRepository, prReviewViewerDetailRepository, prReviewRepository, prReviewDoneRepository, issueTitleCacheRepository) {
        this.prReviewViewerListRepository = prReviewViewerListRepository;
        this.prReviewViewerDetailRepository = prReviewViewerDetailRepository;
        this.prReviewRepository = prReviewRepository;
        this.prReviewDoneRepository = prReviewDoneRepository;
        this.issueTitleCacheRepository = issueTitleCacheRepository;
        this.getList = async (projectCode) => {
            const allItems = await this.prReviewViewerListRepository.getList(projectCode);
            const doneItems = await this.prReviewDoneRepository.getAllDone();
            const doneSet = new Set(doneItems.map((d) => `${d.owner}/${d.repo}#${d.prNumber}`));
            return allItems.filter((item) => {
                const [owner, repo] = item.pr.repo.split('/');
                const key = `${owner}/${repo}#${item.pr.number}`;
                return !doneSet.has(key);
            });
        };
        this.getDetail = async (projectCode, repo, prNumber) => {
            return this.prReviewViewerDetailRepository.getDetail(projectCode, repo, prNumber);
        };
        this.executeReview = async (projectCode, request) => {
            const repoStr = request.repo;
            const repoParts = repoStr.split('/');
            if (repoParts.length !== 2) {
                return { ok: false, error: `Invalid repo format: ${repoStr}` };
            }
            const owner = repoParts[0];
            const repoName = repoParts[1];
            const { action, prNumber } = request;
            try {
                if (action === 'APPROVE') {
                    await this.prReviewRepository.approve(owner, repoName, prNumber, request.body, request.comments);
                    await this.prReviewRepository.updateProjectItemStatus(request.projectId, request.statusFieldId, request.projectItemId, request.awaitingWorkspaceStatusOptionId);
                    await this.safeMarkDone(owner, repoName, prNumber);
                }
                else if (action === 'REQUEST_CHANGES') {
                    await this.prReviewRepository.requestChanges(owner, repoName, prNumber, request.body, request.comments);
                    await this.prReviewRepository.updateProjectItemStatus(request.projectId, request.statusFieldId, request.projectItemId, request.awaitingWorkspaceStatusOptionId);
                    await this.safeMarkDone(owner, repoName, prNumber);
                }
                else if (action === 'COMMENT') {
                    await this.prReviewRepository.comment(owner, repoName, prNumber, request.body, request.comments);
                }
                else if (action === 'CLOSE_WRONG') {
                    await this.prReviewRepository.createComment(owner, repoName, prNumber, 'totally wrong');
                    await this.prReviewRepository.closePullRequest(owner, repoName, prNumber);
                    await this.safeMarkDone(owner, repoName, prNumber);
                }
                else if (action === 'CLOSE_UNNEEDED') {
                    await this.prReviewRepository.createComment(owner, repoName, prNumber, 'This pull request is unnecessary.');
                    const list = await this.prReviewViewerListRepository.getList(projectCode);
                    const item = list.find((i) => i.pr.repo === repoStr && i.pr.number === prNumber);
                    if (item) {
                        const { owner: issueOwner, repo: issueRepo, number: issueNumber, } = this.parseIssueUrl(item.issue.url);
                        if (issueOwner && issueRepo && issueNumber) {
                            await this.prReviewRepository.addLabel(issueOwner, issueRepo, issueNumber, 'chore');
                        }
                    }
                    await this.prReviewRepository.closePullRequest(owner, repoName, prNumber);
                    await this.safeMarkDone(owner, repoName, prNumber);
                }
                else {
                    return { ok: false, error: 'Unsupported action' };
                }
                return { ok: true };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false, error: message };
            }
        };
        this.getFileContent = async (owner, repo, filePath, ref, prHeadSha) => {
            return this.prReviewRepository.getFileContent(owner, repo, filePath, ref, prHeadSha);
        };
        this.getIssueTitleInfo = async (owner, repo, number) => {
            const cached = await this.issueTitleCacheRepository.get(owner, repo, number);
            if (cached) {
                return cached;
            }
            const info = await this.prReviewRepository.getIssueOrPrTitle(owner, repo, number);
            await this.issueTitleCacheRepository.set(owner, repo, number, info);
            return info;
        };
        this.safeMarkDone = async (owner, repo, prNumber) => {
            try {
                await this.prReviewDoneRepository.markDone(owner, repo, prNumber);
            }
            catch (error) {
                process.stderr.write(`safeMarkDone failed for ${owner}/${repo}#${prNumber}: ${error instanceof Error ? error.message : String(error)}\n`);
            }
        };
        this.parseIssueUrl = (url) => {
            const match = url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
            if (!match) {
                return { owner: '', repo: '', number: 0 };
            }
            return {
                owner: match[1],
                repo: match[2],
                number: parseInt(match[4], 10),
            };
        };
    }
}
exports.PrReviewViewerServerStartUseCase = PrReviewViewerServerStartUseCase;
//# sourceMappingURL=PrReviewViewerServerStartUseCase.js.map