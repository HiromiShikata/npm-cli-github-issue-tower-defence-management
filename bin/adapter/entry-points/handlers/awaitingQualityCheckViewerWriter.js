"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAwaitingQualityCheckViewerFile = exports.readDoneStorePrUrls = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const typeGuards_1 = require("../../typeGuards");
const extractPrUrlFromEntry = (entry) => {
    if (typeof entry === 'string')
        return entry;
    if ((0, typeGuards_1.isRecord)(entry)) {
        const urlValue = entry['url'];
        if (typeof urlValue === 'string')
            return urlValue;
    }
    return '';
};
const readDoneStorePrUrls = (doneStorePath) => {
    try {
        const raw = fs_1.default.readFileSync(doneStorePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return new Set(parsed.map(extractPrUrlFromEntry).filter((url) => url !== ''));
        }
        return new Set();
    }
    catch {
        return new Set();
    }
};
exports.readDoneStorePrUrls = readDoneStorePrUrls;
const writeAwaitingQualityCheckViewerFile = (output, outputPath) => {
    const outputDir = path_1.default.dirname(outputPath);
    const tmpPath = `${outputPath}.tmp`;
    fs_1.default.mkdirSync(outputDir, { recursive: true });
    fs_1.default.writeFileSync(tmpPath, JSON.stringify(output, null, 2));
    fs_1.default.rmSync(outputPath, { force: true });
    fs_1.default.renameSync(tmpPath, outputPath);
};
exports.writeAwaitingQualityCheckViewerFile = writeAwaitingQualityCheckViewerFile;
//# sourceMappingURL=awaitingQualityCheckViewerWriter.js.map