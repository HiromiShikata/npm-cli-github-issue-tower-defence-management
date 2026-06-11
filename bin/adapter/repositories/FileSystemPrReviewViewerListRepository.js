"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemPrReviewViewerListRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FileSystemPrReviewViewerListRepository {
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.getList = async (projectCode) => {
            const filePath = path_1.default.join(this.dataDir, projectCode, 'awaiting_quality_check.json');
            if (!fs_1.default.existsSync(filePath)) {
                return [];
            }
            const content = fs_1.default.readFileSync(filePath, 'utf8');
            let parsed;
            try {
                parsed = JSON.parse(content);
            }
            catch {
                return [];
            }
            if (!Array.isArray(parsed)) {
                return [];
            }
            const hasIssueShape = (issue) => {
                if (typeof issue !== 'object' || issue === null) {
                    return false;
                }
                if (!('number' in issue) ||
                    !('title' in issue) ||
                    !('author' in issue) ||
                    !('url' in issue) ||
                    !('story' in issue) ||
                    !('projectItemId' in issue)) {
                    return false;
                }
                return (typeof issue['number'] === 'number' &&
                    typeof issue['title'] === 'string' &&
                    typeof issue['author'] === 'string' &&
                    typeof issue['url'] === 'string' &&
                    (issue['story'] === null || typeof issue['story'] === 'string') &&
                    typeof issue['projectItemId'] === 'string');
            };
            const hasPrShape = (pr) => {
                if (typeof pr !== 'object' || pr === null) {
                    return false;
                }
                if (!('number' in pr) ||
                    !('repo' in pr) ||
                    !('title' in pr) ||
                    !('additions' in pr) ||
                    !('deletions' in pr) ||
                    !('changedFiles' in pr) ||
                    !('url' in pr)) {
                    return false;
                }
                return (typeof pr['number'] === 'number' &&
                    typeof pr['repo'] === 'string' &&
                    typeof pr['title'] === 'string' &&
                    typeof pr['additions'] === 'number' &&
                    typeof pr['deletions'] === 'number' &&
                    typeof pr['changedFiles'] === 'number' &&
                    typeof pr['url'] === 'string');
            };
            const isPrReviewViewerItem = (item) => {
                if (typeof item !== 'object' || item === null) {
                    return false;
                }
                if (!('issue' in item) || !('pr' in item)) {
                    return false;
                }
                return hasIssueShape(item['issue']) && hasPrShape(item['pr']);
            };
            return parsed.filter(isPrReviewViewerItem);
        };
    }
}
exports.FileSystemPrReviewViewerListRepository = FileSystemPrReviewViewerListRepository;
//# sourceMappingURL=FileSystemPrReviewViewerListRepository.js.map