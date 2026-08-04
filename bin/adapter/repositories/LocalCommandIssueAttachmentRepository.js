"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCommandIssueAttachmentRepository = exports.sanitizeAttachmentFileName = exports.UPLOAD_COMMAND = void 0;
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
exports.UPLOAD_COMMAND = 'upload-file-to-gh-issue';
const sanitizeAttachmentFileName = (fileName) => {
    const base = fileName.split('/').pop() ?? '';
    const sanitized = base.replace(/[^A-Za-z0-9._-]/g, '_');
    return sanitized.length === 0 ? 'attachment' : sanitized;
};
exports.sanitizeAttachmentFileName = sanitizeAttachmentFileName;
class LocalCommandIssueAttachmentRepository {
    constructor(localCommandRunner, temporaryDirectoryRoot = (0, os_1.tmpdir)()) {
        this.localCommandRunner = localCommandRunner;
        this.temporaryDirectoryRoot = temporaryDirectoryRoot;
    }
    async uploadAttachment(request) {
        const directory = await (0, promises_1.mkdtemp)((0, path_1.join)(this.temporaryDirectoryRoot, 'console-attachment-'));
        const filePath = (0, path_1.join)(directory, (0, exports.sanitizeAttachmentFileName)(request.fileName));
        try {
            await (0, promises_1.writeFile)(filePath, request.content);
            const result = await this.localCommandRunner.runCommand(exports.UPLOAD_COMMAND, [
                filePath,
                request.issueOrPullRequestUrl,
            ]);
            if (result.exitCode !== 0) {
                throw new Error(`${exports.UPLOAD_COMMAND} failed with exit code ${result.exitCode}: ${result.stderr.trim()}`);
            }
            const markdown = result.stdout.trim();
            if (markdown.length === 0) {
                throw new Error(`${exports.UPLOAD_COMMAND} returned no markdown`);
            }
            return markdown;
        }
        finally {
            await (0, promises_1.rm)(directory, { recursive: true, force: true });
        }
    }
}
exports.LocalCommandIssueAttachmentRepository = LocalCommandIssueAttachmentRepository;
//# sourceMappingURL=LocalCommandIssueAttachmentRepository.js.map