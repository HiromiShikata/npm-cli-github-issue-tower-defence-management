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
                .filter((fileName) => !fileName.endsWith('.tmp'))
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
            catch {
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
            const finalPath = `${dirPath}/${timestamp}.json`;
            const tmpPath = `${finalPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
            this.localStorageRepository.write(tmpPath, JSON.stringify(value));
            this.localStorageRepository.rename(tmpPath, finalPath);
        };
        this.getSingle = async (key) => {
            const dirPath = `${this.cachePath}/${key}`;
            const fileName = 'latest.json';
            if (!this.localStorageRepository.listFiles(dirPath).includes(fileName)) {
                return null;
            }
            const valueStr = this.localStorageRepository.read(`${dirPath}/${fileName}`);
            if (!valueStr) {
                return null;
            }
            try {
                return JSON.parse(valueStr);
            }
            catch {
                return null;
            }
        };
        this.setSingle = async (key, value) => {
            const dirPath = `${this.cachePath}/${key}`;
            this.localStorageRepository.mkdir(dirPath);
            const finalPath = `${dirPath}/latest.json`;
            const tmpPath = `${finalPath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
            this.localStorageRepository.write(tmpPath, JSON.stringify(value));
            this.localStorageRepository.rename(tmpPath, finalPath);
        };
    }
}
exports.LocalStorageCacheRepository = LocalStorageCacheRepository;
//# sourceMappingURL=LocalStorageCacheRepository.js.map