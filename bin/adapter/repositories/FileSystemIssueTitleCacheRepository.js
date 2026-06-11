"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemIssueTitleCacheRepository = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class FileSystemIssueTitleCacheRepository {
    constructor(dataDir) {
        this.inMemoryCache = new Map();
        this.cacheKey = (owner, repo, number) => `${owner}/${repo}#${number}`;
        this.isIssueTitleInfo = (value) => {
            if (typeof value !== 'object' || value === null) {
                return false;
            }
            if (!('title' in value) ||
                !('state' in value) ||
                !('isPR' in value) ||
                !('url' in value)) {
                return false;
            }
            return (typeof value['title'] === 'string' &&
                typeof value['state'] === 'string' &&
                typeof value['isPR'] === 'boolean' &&
                typeof value['url'] === 'string');
        };
        this.loadFromDisk = () => {
            if (!fs_1.default.existsSync(this.filePath)) {
                return;
            }
            try {
                const content = fs_1.default.readFileSync(this.filePath, 'utf8');
                const parsed = JSON.parse(content);
                if (typeof parsed !== 'object' || parsed === null) {
                    return;
                }
                for (const [key, value] of Object.entries(parsed)) {
                    if (this.isIssueTitleInfo(value)) {
                        this.inMemoryCache.set(key, value);
                    }
                }
            }
            catch (_error) {
                process.stderr.write(String(_error) + '\n');
            }
        };
        this.saveToDisk = () => {
            const store = {};
            for (const [key, value] of this.inMemoryCache.entries()) {
                store[key] = value;
            }
            try {
                const dir = path_1.default.dirname(this.filePath);
                if (!fs_1.default.existsSync(dir)) {
                    fs_1.default.mkdirSync(dir, { recursive: true });
                }
                const tmpPath = `${this.filePath}.tmp`;
                fs_1.default.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
                fs_1.default.renameSync(tmpPath, this.filePath);
            }
            catch (_error) {
                process.stderr.write(String(_error) + '\n');
            }
        };
        this.get = async (owner, repo, number) => {
            const key = this.cacheKey(owner, repo, number);
            return this.inMemoryCache.get(key) ?? null;
        };
        this.set = async (owner, repo, number, info) => {
            const key = this.cacheKey(owner, repo, number);
            this.inMemoryCache.set(key, info);
            this.saveToDisk();
        };
        this.filePath = path_1.default.join(dataDir, 'issue_title_cache.json');
        this.loadFromDisk();
    }
}
exports.FileSystemIssueTitleCacheRepository = FileSystemIssueTitleCacheRepository;
//# sourceMappingURL=FileSystemIssueTitleCacheRepository.js.map