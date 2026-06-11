"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemPrReviewViewerDetailRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FileSystemPrReviewViewerDetailRepository {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.getDetail = async (projectCode, repo, prNumber) => {
            const sanitizedRepo = repo.replace(/\//g, '__');
            const filePath = path_1.default.join(this.dataDir, projectCode, 'prs', `${sanitizedRepo}__${prNumber}.json`);
            if (!fs_1.default.existsSync(filePath)) {
                return null;
            }
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            let parsed;
            try {
                parsed = JSON.parse(content);
            }
            catch {
                return null;
            }
            if (typeof parsed !== 'object' || parsed === null) {
                return null;
            }
            return parsed;
        };
    }
}
exports.FileSystemPrReviewViewerDetailRepository = FileSystemPrReviewViewerDetailRepository;
//# sourceMappingURL=FileSystemPrReviewViewerDetailRepository.js.map