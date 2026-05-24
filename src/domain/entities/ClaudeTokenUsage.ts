export type ClaudeModelWeeklyLimit = {
  rejected: boolean;
  resetsAt: number;
};

export type ClaudeTokenUsage = {
  name: string;
  token: string;
  fiveHourUtilization: number;
  blocked: boolean;
  rejected: boolean;
  modelWeeklyLimits: Record<string, ClaudeModelWeeklyLimit>;
};
