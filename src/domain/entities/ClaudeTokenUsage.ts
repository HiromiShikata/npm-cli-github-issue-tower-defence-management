export type ClaudeModelWeeklyLimit = {
  rejected: boolean;
  resetsAt: number;
};

export type ClaudeTokenUsage = {
  token: string;
  fiveHourUtilization: number;
  sevenDayUtilization: number;
  blocked: boolean;
  rejected: boolean;
  modelWeeklyLimits: Record<string, ClaudeModelWeeklyLimit>;
};
