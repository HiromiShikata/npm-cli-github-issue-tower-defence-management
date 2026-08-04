import { IssueAttachmentRepository, IssueAttachmentUploadRequest } from '../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import { LocalCommandRunner } from '../../domain/usecases/adapter-interfaces/LocalCommandRunner';
export declare const UPLOAD_COMMAND = "upload-file-to-gh-issue";
export declare const sanitizeAttachmentFileName: (fileName: string) => string;
export declare class LocalCommandIssueAttachmentRepository implements IssueAttachmentRepository {
    private readonly localCommandRunner;
    private readonly temporaryDirectoryRoot;
    constructor(localCommandRunner: LocalCommandRunner, temporaryDirectoryRoot?: string);
    uploadAttachment(request: IssueAttachmentUploadRequest): Promise<string>;
}
//# sourceMappingURL=LocalCommandIssueAttachmentRepository.d.ts.map