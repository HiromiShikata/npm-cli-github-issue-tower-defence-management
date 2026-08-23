"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCommandIssueAttachmentRepository = exports.relabelAttachmentMarkdown = exports.resolveAttachmentExtension = exports.sanitizeAttachmentFileName = exports.UPLOAD_FILE_BASE_NAME = exports.ALLOWED_ATTACHMENT_EXTENSIONS = exports.UPLOAD_COMMAND = void 0;
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
exports.UPLOAD_COMMAND = 'upload-file-to-gh-issue';
exports.ALLOWED_ATTACHMENT_EXTENSIONS = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.pdf',
    '.txt',
    '.md',
    '.log',
    '.csv',
    '.json',
    '.zip',
    '.mov',
    '.mp4',
];
exports.UPLOAD_FILE_BASE_NAME = 'attachment';
const sanitizeAttachmentFileName = (fileName) => {
    const base = fileName.split('/').pop() ?? '';
    const sanitized = base.replace(/[^A-Za-z0-9._-]/g, '_');
    return sanitized.length === 0 ? exports.UPLOAD_FILE_BASE_NAME : sanitized;
};
exports.sanitizeAttachmentFileName = sanitizeAttachmentFileName;
const resolveAttachmentExtension = (fileName) => {
    const lower = (0, exports.sanitizeAttachmentFileName)(fileName).toLowerCase();
    const matched = exports.ALLOWED_ATTACHMENT_EXTENSIONS.find((extension) => lower.endsWith(extension));
    return matched === undefined ? '' : matched;
};
exports.resolveAttachmentExtension = resolveAttachmentExtension;
const relabelAttachmentMarkdown = (markdown, label) => {
    const match = /^(!?)\[[^\]]*\]\((.*)\)$/.exec(markdown);
    if (match === null) {
        return markdown;
    }
    return `${match[1]}[${label}](${match[2]})`;
};
exports.relabelAttachmentMarkdown = relabelAttachmentMarkdown;
class LocalCommandIssueAttachmentRepository {
    constructor(localCommandRunner, temporaryDirectoryRoot = (0, os_1.tmpdir)(), resolveGithubToken) {
        this.localCommandRunner = localCommandRunner;
        this.temporaryDirectoryRoot = temporaryDirectoryRoot;
        this.resolveGithubToken = resolveGithubToken;
    }
    async uploadAttachment(request) {
        const directory = await (0, promises_1.mkdtemp)((0, path_1.join)(this.temporaryDirectoryRoot, 'console-attachment-'));
        const filePath = (0, path_1.join)(directory, `${exports.UPLOAD_FILE_BASE_NAME}${(0, exports.resolveAttachmentExtension)(request.fileName)}`);
        try {
            await (0, promises_1.writeFile)(filePath, request.content);
            let commandOptions;
            if (this.resolveGithubToken !== undefined) {
                const ownerMatch = request.issueOrPullRequestUrl.match(/https:\/\/github\.com\/([A-Za-z0-9._-]+)\//);
                if (ownerMatch !== null) {
                    commandOptions = {
                        env: { GH_TOKEN: this.resolveGithubToken(ownerMatch[1]) },
                    };
                }
            }
            const result = await this.localCommandRunner.runCommand(exports.UPLOAD_COMMAND, [filePath, request.issueOrPullRequestUrl], commandOptions);
            if (result.exitCode !== 0) {
                throw new Error(`${exports.UPLOAD_COMMAND} failed with exit code ${result.exitCode}: ${result.stderr.trim()}`);
            }
            const markdown = result.stdout.trim();
            if (markdown.length === 0) {
                throw new Error(`${exports.UPLOAD_COMMAND} returned no markdown`);
            }
            return (0, exports.relabelAttachmentMarkdown)(markdown, (0, exports.sanitizeAttachmentFileName)(request.fileName));
        }
        finally {
            await (0, promises_1.rm)(directory, { recursive: true, force: true });
        }
    }
}
exports.LocalCommandIssueAttachmentRepository = LocalCommandIssueAttachmentRepository;
//# sourceMappingURL=LocalCommandIssueAttachmentRepository.js.map