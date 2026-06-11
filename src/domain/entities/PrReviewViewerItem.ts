export type PrReviewViewerIssue = {
  number: number;
  title: string;
  author: string;
  url: string;
  story: string | null;
  projectItemId: string;
};

export type PrReviewViewerPr = {
  number: number;
  repo: string;
  title: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  url: string;
};

export type PrReviewViewerItem = {
  issue: PrReviewViewerIssue;
  pr: PrReviewViewerPr;
};

export type PrReviewAction =
  | 'APPROVE'
  | 'REQUEST_CHANGES'
  | 'COMMENT'
  | 'CLOSE_WRONG'
  | 'CLOSE_UNNEEDED';

export type PrReviewRequest = {
  action: PrReviewAction;
  repo: string;
  prNumber: number;
  projectItemId: string;
  projectId: string;
  statusFieldId: string;
  awaitingWorkspaceStatusOptionId: string;
  body?: string;
  comments?: {
    path: string;
    position: number;
    body: string;
  }[];
};

export type IssueTitleInfo = {
  title: string;
  state: string;
  isPR: boolean;
  url: string;
};
