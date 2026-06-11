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
            return parsed;
        };
    }
}
exports.FileSystemPrReviewViewerListRepository = FileSystemPrReviewViewerListRepository;
//# sourceMappingURL=FileSystemPrReviewViewerListRepository.js.map