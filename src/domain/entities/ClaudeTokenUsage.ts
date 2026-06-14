export type ClaudeModelWeeklyLimit = {
  rejected: boolean;
  resetsAt: number;
};

export type ClaudeTokenUsage = {
  name?: string;
  token: string;
  fiveHourUtilization: number;
  sevenDayUtilization: number;
  blocked: boolean;
  rejected: boolean;
  fiveHourRejected: boolean;
  modelWeeklyLimits: Record<string, ClaudeModelWeeklyLimit>;
  blockedUntilEpoch: number;
};
