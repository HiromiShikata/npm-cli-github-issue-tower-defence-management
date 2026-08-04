export type IssueAttachmentUploadRequest = {
    issueOrPullRequestUrl: string;
    fileName: string;
    content: Uint8Array;
};
export interface IssueAttachmentRepository {
    uploadAttachment(request: IssueAttachmentUploadRequest): Promise<string>;
}
//# sourceMappingURL=IssueAttachmentRepository.d.ts.map