export type IssueAttachmentSingleUploadRequest = {
  issueOrPullRequestUrl: string;
  fileName: string;
  content: Uint8Array;
};

export type IssueAttachmentBatchUploadRequest = {
  issueOrPullRequestUrl: string;
  files: { fileName: string; content: Uint8Array }[];
};

export type IssueAttachmentUploadRequest =
  IssueAttachmentSingleUploadRequest | IssueAttachmentBatchUploadRequest;

export type IssueAttachmentUploadResult =
  | { fileName: string; status: 'uploaded'; markdown: string }
  | { fileName: string; status: 'failed'; error: string };

export interface IssueAttachmentRepository {
  uploadAttachment(
    request: IssueAttachmentUploadRequest,
  ): Promise<IssueAttachmentUploadResult[] | string>;
}
