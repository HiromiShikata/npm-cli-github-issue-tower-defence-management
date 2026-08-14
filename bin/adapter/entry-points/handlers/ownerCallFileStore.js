"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerCallProjectCodeInInTmuxByHumanData = exports.ownerCallFileDeleteInEveryProject = exports.ownerCallFileDelete = exports.ownerCallFileAppend = exports.ownerCallFilePath = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const OwnerCallFile_1 = require("../../../domain/usecases/intmux/OwnerCallFile");
const ownerCallFilePath = (dataDir, projectCode, sessionName) => path_1.default.join(dataDir, (0, OwnerCallFile_1.ownerCallFileRelativePath)(projectCode, sessionName));
exports.ownerCallFilePath = ownerCallFilePath;
const ownerCallFileAppend = (params) => {
    const filePath = (0, exports.ownerCallFilePath)(params.dataDir, params.projectCode, params.ownerCall.sessionName);
    fs_1.default.mkdirSync(path_1.default.dirname(filePath), { recursive: true });
    fs_1.default.appendFileSync(filePath, (0, OwnerCallFile_1.ownerCallYamlDocument)(params.ownerCall));
};
exports.ownerCallFileAppend = ownerCallFileAppend;
const ownerCallFileDelete = (params) => {
    fs_1.default.rmSync((0, exports.ownerCallFilePath)(params.dataDir, params.projectCode, params.sessionName), { force: true });
};
exports.ownerCallFileDelete = ownerCallFileDelete;
const projectCodeDirectoryNames = (dataDir) => {
    const ownerCallDirectory = path_1.default.join(dataDir, OwnerCallFile_1.OWNER_CALL_FILE_DIRECTORY_NAME);
    if (!fs_1.default.existsSync(ownerCallDirectory)) {
        return [];
    }
    return fs_1.default
        .readdirSync(ownerCallDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
};
const ownerCallFileDeleteInEveryProject = (params) => {
    for (const projectCode of projectCodeDirectoryNames(params.dataDir)) {
        (0, exports.ownerCallFileDelete)({
            dataDir: params.dataDir,
            projectCode,
            sessionName: params.sessionName,
        });
    }
};
exports.ownerCallFileDeleteInEveryProject = ownerCallFileDeleteInEveryProject;
// The in-tmux-by-human data the scheduled run writes into the same directory
// serveWeb serves: one `{projectCode}.v4.json` per project, each listing the
// sessions of that project. `index.v4.json` only names the project files, so
// it is not read here.
const IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX = '.v4.json';
const IN_TMUX_BY_HUMAN_INDEX_FILE_NAME = `index${IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX}`;
const isUnknownArray = (value) => Array.isArray(value);
const isRecord = (value) => typeof value === 'object' && value !== null;
const arrayOrEmpty = (value) => isUnknownArray(value) ? value : [];
const propertyOrUndefined = (value, key) => isRecord(value) ? value[key] : undefined;
const sessionNamesInProjectDataFile = (filePath) => {
    let parsed;
    try {
        parsed = JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8'));
    }
    catch {
        return [];
    }
    return arrayOrEmpty(propertyOrUndefined(parsed, 'groups')).flatMap((group) => arrayOrEmpty(propertyOrUndefined(group, 'sessions'))
        .map((session) => propertyOrUndefined(session, 'name'))
        .filter((name) => typeof name === 'string'));
};
const inTmuxByHumanProjectSessionNames = (dataDir) => {
    if (!fs_1.default.existsSync(dataDir)) {
        return [];
    }
    return fs_1.default
        .readdirSync(dataDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() &&
        entry.name.endsWith(IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX) &&
        entry.name !== IN_TMUX_BY_HUMAN_INDEX_FILE_NAME)
        .map((entry) => ({
        projectCode: entry.name.slice(0, entry.name.length - IN_TMUX_BY_HUMAN_PROJECT_DATA_SUFFIX.length),
        sessionNames: sessionNamesInProjectDataFile(path_1.default.join(dataDir, entry.name)),
    }));
};
const ownerCallProjectCodeInInTmuxByHumanData = (dataDir, sessionName) => (0, OwnerCallFile_1.ownerCallProjectCodeOfSession)(inTmuxByHumanProjectSessionNames(dataDir), sessionName);
exports.ownerCallProjectCodeInInTmuxByHumanData = ownerCallProjectCodeInInTmuxByHumanData;
//# sourceMappingURL=ownerCallFileStore.js.map