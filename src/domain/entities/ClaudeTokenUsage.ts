export type ClaudeModelWeeklyLimit = {
  rejected: boolean;
  resetsAt: number;
};

export type ClaudeTokenUsage = {
  token: string;
  fiveHourUtilization: number;
  sevenDayReset: number | null;
  blocked: boolean;
  rejected: boolean;
  modelWeeklyLimits: Record<string, ClaudeModelWeeklyLimit>;
};
