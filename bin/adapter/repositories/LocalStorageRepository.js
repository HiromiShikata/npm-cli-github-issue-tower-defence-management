"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalStorageRepository = void 0;
const fs_1 = __importDefault(require("fs"));
class LocalStorageRepository {
    constructor() {
        this.write = (path, value) => {
            const dirPath = path.split('/').slice(0, -1).join('/');
            this.mkdir(dirPath);
            fs_1.default.writeFileSync(path, value, 'utf8');
        };
        this.read = (path) => {
            return fs_1.default.readFileSync(path, 'utf8');
        };
        this.listFiles = (dirPath) => {
            if (!fs_1.default.existsSync(dirPath)) {
                return [];
            }
            return fs_1.default.readdirSync(dirPath);
        };
        this.mkdir = (dirPath) => {
            fs_1.default.mkdirSync(dirPath, { recursive: true });
        };
    }
}
exports.LocalStorageRepository = LocalStorageRepository;
//# sourceMappingURL=LocalStorageRepository.js.map