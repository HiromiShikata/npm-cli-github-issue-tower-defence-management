export type CodexRunningWorkerListResult = {
  issueUrls: string[];
  errorMessages: string[];
};

export type CodexRunningWorkerRepository = {
  listRunningCodexWorkerIssueUrls: () => CodexRunningWorkerListResult;
};
