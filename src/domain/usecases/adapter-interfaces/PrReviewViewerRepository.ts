import {
  PrReviewViewerItem,
  PrReviewRequest,
  IssueTitleInfo,
} from '../../entities/PrReviewViewerItem';

export interface PrReviewViewerListRepository {
  getList: (projectCode: string) => Promise<PrReviewViewerItem[]>;
}

export interface PrReviewViewerDetailRepository {
  getDetail: (
    projectCode: string,
    repo: string,
    prNumber: number,
  ) => Promise<object | null>;
}

export interface PrReviewRepository {
  approve: (
    owner: string,
    repo: string,
    prNumber: number,
    body?: string,
    comments?: PrReviewRequest['comments'],
  ) => Promise<void>;
  requestChanges: (
    owner: string,
    repo: string,
    prNumber: number,
    body?: string,
    comments?: PrReviewRequest['comments'],
  ) => Promise<void>;
  comment: (
    owner: string,
    repo: string,
    prNumber: number,
    body?: string,
    comments?: PrReviewRequest['comments'],
  ) => Promise<void>;
  createComment: (
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ) => Promise<void>;
  closePullRequest: (
    owner: string,
    repo: string,
    prNumber: number,
  ) => Promise<void>;
  addLabel: (
    owner: string,
    repo: string,
    issueNumber: number,
    label: string,
  ) => Promise<void>;
  updateProjectItemStatus: (
    projectId: string,
    fieldId: string,
    itemId: string,
    statusOptionId: string,
  ) => Promise<void>;
  getFileContent: (
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    prHeadSha: string,
  ) => Promise<{ content: Buffer; contentType: string }>;
  getIssueOrPrTitle: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<IssueTitleInfo>;
}

export interface PrReviewDoneRepository {
  markDone: (owner: string, repo: string, prNumber: number) => Promise<void>;
  isDone: (owner: string, repo: string, prNumber: number) => Promise<boolean>;
  getAllDone: () => Promise<
    { owner: string; repo: string; prNumber: number }[]
  >;
}

export interface IssueTitleCacheRepository {
  get: (
    owner: string,
    repo: string,
    number: number,
  ) => Promise<IssueTitleInfo | null>;
  set: (
    owner: string,
    repo: string,
    number: number,
    info: IssueTitleInfo,
  ) => Promise<void>;
}
