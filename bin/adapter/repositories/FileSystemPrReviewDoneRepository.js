"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemPrReviewDoneRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FileSystemPrReviewDoneRepository {
    constructor(dataDir) {
        this.isDoneRecord = (value) => {
            if (typeof value !== 'object' || value === null) {
                return false;
            }
            if (!('owner' in value) ||
                !('repo' in value) ||
                !('prNumber' in value) ||
                !('doneAt' in value)) {
                return false;
            }
            return (typeof value['owner'] === 'string' &&
                typeof value['repo'] === 'string' &&
                typeof value['prNumber'] === 'number' &&
                typeof value['doneAt'] === 'string');
        };
        this.readRecords = () => {
            if (!fs_1.default.existsSync(this.filePath)) {
                return [];
            }
            try {
                const content = fs_1.default.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(content);
                if (!Array.isArray(parsed)) {
                    return [];
                }
                return parsed.filter(this.isDoneRecord);
            }
            catch (_error) {
                void _error;
                return [];
            }
        };
        this.writeRecords = (records) => {
            const dir = path_1.default.dirname(this.filePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            const tmpPath = `${this.filePath}.tmp`;
            fs_1.default.writeFileSync(tmpPath, JSON.stringify(records, null, 2), 'utf8');
            fs_1.default.renameSync(tmpPath, this.filePath);
        };
        this.markDone = async (owner, repo, prNumber) => {
            const records = this.readRecords();
            const alreadyExists = records.some((r) => r.owner === owner && r.repo === repo && r.prNumber === prNumber);
            if (alreadyExists) {
                return;
            }
            records.push({ owner, repo, prNumber, doneAt: new Date().toISOString() });
            this.writeRecords(records);
        };
        this.isDone = async (owner, repo, prNumber) => {
            const records = this.readRecords();
            return records.some((r) => r.owner === owner && r.repo === repo && r.prNumber === prNumber);
        };
        this.getAllDone = async () => {
            return this.readRecords().map(({ owner, repo, prNumber }) => ({
                owner,
                repo,
                prNumber,
            }));
        };
        this.filePath = path_1.default.join(dataDir, 'done_prs.json');
    }
}
exports.FileSystemPrReviewDoneRepository = FileSystemPrReviewDoneRepository;
//# sourceMappingURL=FileSystemPrReviewDoneRepository.js.map