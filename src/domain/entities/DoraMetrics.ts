export type WorkflowRun = {
  conclusion: 'success' | 'failure' | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MergedPullRequest = {
  mergedAt: Date;
  createdAt: Date;
};

export type ClosedItem = {
  createdAt: Date;
  closedAt: Date;
};

export type ProjectDoraConfig = {
  name: string;
  owner: string;
  repo: string;
  deployWorkflowFiles: string[];
  deployBranch: string | null;
  prBaseBranch: string | null;
  mttrLabels: string[];
  ghTokenEnvVar: string | null;
};

export type ProjectDoraMetrics = {
  projectName: string;
  deployFrequency: number;
  changeFailureRate: number | null;
  changeLeadTimeHours: number | null;
  mttrHours: number | null;
};
