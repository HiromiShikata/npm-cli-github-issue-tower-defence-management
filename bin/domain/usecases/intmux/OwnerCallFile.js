"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerCallYamlDocument = exports.isOwnerCallCalledAtValid = exports.ownerCallProjectCodeOfSession = exports.ownerCallFileRelativePath = exports.ownerCallFileSessionKey = exports.OWNER_CALL_FILE_EXTENSION = exports.OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT = exports.OWNER_CALL_FILE_DIRECTORY_NAME = void 0;
const InTmuxByHumanSessionReconcileUseCase_1 = require("./InTmuxByHumanSessionReconcileUseCase");
exports.OWNER_CALL_FILE_DIRECTORY_NAME = 'call-to-user';
exports.OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT = 'NA';
exports.OWNER_CALL_FILE_EXTENSION = '.yaml';
// The key one owner call file is named by. It is the tmux session name
// derivation every other in-tmux caller uses, followed by the replacement of
// the slashes tmux keeps but a file name cannot hold. Applying it to a name
// that already went through it gives that same name back, so the writing side,
// which knows the tmux session name, and the reading side, which knows the
// issue url, reach the same file.
const ownerCallFileSessionKey = (sessionName) => (0, InTmuxByHumanSessionReconcileUseCase_1.toTmuxSessionName)(sessionName).replace(/\//g, '_');
exports.ownerCallFileSessionKey = ownerCallFileSessionKey;
const ownerCallFileRelativePath = (projectCode, sessionName) => {
    const directory = projectCode ?? exports.OWNER_CALL_FILE_PROJECT_CODE_FOR_NO_PROJECT;
    const fileName = (0, exports.ownerCallFileSessionKey)(sessionName);
    return `${exports.OWNER_CALL_FILE_DIRECTORY_NAME}/${directory}/${fileName}${exports.OWNER_CALL_FILE_EXTENSION}`;
};
exports.ownerCallFileRelativePath = ownerCallFileRelativePath;
const ownerCallProjectCodeOfSession = (projects, sessionName) => {
    const key = (0, exports.ownerCallFileSessionKey)(sessionName);
    const owningProject = projects.find((project) => project.sessionNames.some((candidate) => (0, exports.ownerCallFileSessionKey)(candidate) === key));
    return owningProject ? owningProject.projectCode : null;
};
exports.ownerCallProjectCodeOfSession = ownerCallProjectCodeOfSession;
const CALLED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const isOwnerCallCalledAtValid = (calledAt) => {
    if (!CALLED_AT_PATTERN.test(calledAt)) {
        return false;
    }
    const parsed = new Date(calledAt);
    return (Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().replace(/\.\d{3}Z$/, 'Z') === calledAt);
};
exports.isOwnerCallCalledAtValid = isOwnerCallCalledAtValid;
const BODY_INDENTATION = '  ';
const bodyBlockLines = (body) => body
    .replace(/\n+$/, '')
    .split('\n')
    .map((line) => (line.length === 0 ? '' : `${BODY_INDENTATION}${line}`));
const ownerCallYamlDocument = (ownerCall) => [
    '---',
    `sessionName: ${JSON.stringify(ownerCall.sessionName)}`,
    `calledAt: ${JSON.stringify(ownerCall.calledAt)}`,
    `body: |${BODY_INDENTATION.length}`,
    ...bodyBlockLines(ownerCall.body),
    '',
].join('\n');
exports.ownerCallYamlDocument = ownerCallYamlDocument;
//# sourceMappingURL=OwnerCallFile.js.map