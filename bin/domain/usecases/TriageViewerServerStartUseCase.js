"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriageViewerServerStartUseCase = void 0;
class TriageViewerServerStartUseCase {
    constructor(triageRepository) {
        this.triageRepository = triageRepository;
        this.getTriageData = async (projectUrl) => {
            return this.triageRepository.getTriageData(projectUrl);
        };
        this.setStory = async (request) => {
            try {
                await this.triageRepository.setStory(request.projectId, request.storyFieldId, request.itemId, request.storyOptionId);
                return { ok: true };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false, error: message };
            }
        };
        this.closeIssue = async (request) => {
            try {
                await this.triageRepository.closeIssue(request.owner, request.repo, request.issueNumber, request.reason);
                return { ok: true };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                return { ok: false, error: message };
            }
        };
        this.fetchImageProxy = async (targetUrl) => {
            return this.triageRepository.fetchImageProxy(targetUrl);
        };
    }
}
exports.TriageViewerServerStartUseCase = TriageViewerServerStartUseCase;
//# sourceMappingURL=TriageViewerServerStartUseCase.js.map