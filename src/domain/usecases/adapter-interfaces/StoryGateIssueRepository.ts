export type GithubIssueReference = {
  owner: string;
  repo: string;
  number: number;
  url: string;
};

export type StoryGateIssueState = 'OPEN' | 'CLOSED';

export type StoryGateIssue = {
  url: string;
  state: StoryGateIssueState;
  body: string;
  labels: string[];
};

export type StoryGateIssueComment = {
  url: string;
  createdAt: string;
  body: string;
};

export type ClosingPullRequestState = 'OPEN' | 'CLOSED' | 'MERGED';

export type ClosingPullRequest = {
  url: string;
  state: ClosingPullRequestState;
};

export type ProjectSingleSelectOption = {
  id: string;
  name: string;
  color: string;
};

export type ProjectSingleSelectField = {
  fieldId: string;
  options: ProjectSingleSelectOption[];
};

export type IssueProjectItem = {
  projectId: string;
  itemId: string;
  storyField: ProjectSingleSelectField | null;
  storyName: string | null;
  agentField: ProjectSingleSelectField | null;
  agentName: string | null;
  statusField: ProjectSingleSelectField | null;
  statusName: string | null;
};

export type IssueProjectItemsSnapshot = {
  state: StoryGateIssueState;
  items: IssueProjectItem[];
};

export type ProjectItemSingleSelectValueUpdate = {
  projectId: string;
  itemId: string;
  fieldId: string;
  optionId: string;
};

export class StoryGateGithubRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryGateGithubRequestError';
  }
}

export interface StoryGateIssueRepository {
  findIssue(issue: GithubIssueReference): Promise<StoryGateIssue | null>;
  listIssueComments(
    issue: GithubIssueReference,
  ): Promise<StoryGateIssueComment[]>;
  findIssueProjectItems(
    issue: GithubIssueReference,
  ): Promise<IssueProjectItemsSnapshot | null>;
  listClosingPullRequests(
    issue: GithubIssueReference,
  ): Promise<ClosingPullRequest[]>;
  updateProjectItemSingleSelectValue(
    update: ProjectItemSingleSelectValueUpdate,
  ): Promise<void>;
}
