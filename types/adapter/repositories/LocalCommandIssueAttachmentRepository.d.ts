import { IssueAttachmentRepository, IssueAttachmentUploadRequest } from '../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export declare const UPLOAD_COMMAND = "upload-file-to-gh-issue";
export type IssueAttachmentGithubTokenResolver = (issueOrPullRequestUrl: string) => string;
export declare const ALLOWED_ATTACHMENT_EXTENSIONS: readonly [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".pdf", ".txt", ".md", ".log", ".csv", ".json", ".zip", ".mov", ".mp4"];
export declare const UPLOAD_FILE_BASE_NAME = "attachment";
export declare const sanitizeAttachmentFileName: (fileName: string) => string;
export declare const resolveAttachmentExtension: (fileName: string) => string;
export declare const relabelAttachmentMarkdown: (markdown: string, label: string) => string;
export declare class LocalCommandIssueAttachmentRepository implements IssueAttachmentRepository {
    private readonly localCommandRunner;
    private readonly resolveGithubToken;
    private readonly temporaryDirectoryRoot;
    constructor(localCommandRunner: LocalCommandRunner, resolveGithubToken: IssueAttachmentGithubTokenResolver, temporaryDirectoryRoot?: string);
    uploadAttachment(request: IssueAttachmentUploadRequest): Promise<string>;
}
//# sourceMappingURL=LocalCommandIssueAttachmentRepository.d.ts.map