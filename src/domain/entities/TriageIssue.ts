export type IssueCloseReason = 'completed' | 'not_planned' | 'duplicate';

export type StoryOption = {
  id: string;
  name: string;
  color: string;
};

export type TriageIssue = {
  number: number;
  title: string;
  body: string;
  url: string;
  owner: string;
  repo: string;
  itemId: string;
};

export type TriageData = {
  issues: TriageIssue[];
  storyOptions: StoryOption[];
  storyFieldId: string;
  projectId: string;
};
