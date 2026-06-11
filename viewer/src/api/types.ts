export type StoryDefinition = {
  name: string;
  color: string;
  order: number;
};

export type PrListItem = {
  issue: {
    number: number;
    title: string;
    author: string;
    url: string;
    story: string;
    projectItemId: string;
  };
  pr: {
    number: number;
    repo: string;
    title: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    url: string;
  };
  changedDirectories: string[];
};

export type PrListResponse = {
  stories: StoryDefinition[];
  items: PrListItem[];
};

export type IssueComment = {
  author: string;
  body: string;
  createdAt: string;
};

export type PrFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
};

export type PrDetailResponse = {
  issue: {
    number: number;
    title: string;
    body: string;
    author: string;
    comments: IssueComment[];
  };
  pr: {
    number: number;
    title: string;
    body: string;
    headSha: string;
    files: PrFile[];
  };
};

export type ReviewAction = 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' | 'CLOSE_WRONG' | 'CLOSE_UNNEEDED';

export type DiffLineComment = {
  filename: string;
  line: number;
  body: string;
};

export type RefResolution = {
  title: string;
  state: string;
  isPR: boolean;
  url: string;
};
