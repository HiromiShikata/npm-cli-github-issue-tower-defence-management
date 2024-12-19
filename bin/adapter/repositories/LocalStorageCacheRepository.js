"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageCacheRepository = void 0;
class LocalStorageCacheRepository {
    constructor(localStorageRepository, cachePath = './tmp/cache') {
        this.localStorageRepository = localStorageRepository;
        this.cachePath = cachePath;
        this.getLatest = async (key) => {
            const dirPath = `${this.cachePath}/${key}`;
            const latestFile = this.localStorageRepository
                .listFiles(dirPath)
                .sort((a, b) => a.localeCompare(b))
                .reverse()[0];
            if (!latestFile) {
                return null;
            }
            const valueStr = this.localStorageRepository.read(`${dirPath}/${latestFile}`);
            if (!valueStr) {
                return null;
            }
            let value;
            try {
                value = JSON.parse(valueStr);
            }
            catch (e) {
                return null;
            }
            if (typeof value !== 'object' || value === null) {
                return null;
            }
            const timestampStr = latestFile.split('.')[0];
            return {
                value,
                timestamp: new Date(timestampStr),
            };
        };
        this.set = async (key, value) => {
            const dirPath = `${this.cachePath}/${key}`;
            this.localStorageRepository.mkdir(dirPath);
            const timestamp = new Date().toISOString();
            this.localStorageRepository.write(`${dirPath}/${timestamp}.json`, JSON.stringify(value));
        };
    }
}
exports.LocalStorageCacheRepository = LocalStorageCacheRepository;
//# sourceMappingURL=LocalStorageCacheRepository.js.map