"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectCacheDirectory = exports.localStorageCacheBaseDirectory = void 0;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const localStorageCacheBaseDirectory = () => {
    const base = process.env.XDG_CACHE_HOME ?? node_path_1.default.join(node_os_1.default.homedir(), '.cache');
    return node_path_1.default.join(base, 'tdpm', 'cache');
};
exports.localStorageCacheBaseDirectory = localStorageCacheBaseDirectory;
const projectCacheDirectory = (projectName) => node_path_1.default.join((0, exports.localStorageCacheBaseDirectory)(), projectName);
exports.projectCacheDirectory = projectCacheDirectory;
//# sourceMappingURL=localStorageCacheDirectory.js.map