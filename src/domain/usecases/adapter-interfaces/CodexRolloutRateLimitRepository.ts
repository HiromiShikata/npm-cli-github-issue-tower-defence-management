import { CodexSevenDayRateLimitObservation } from '../dashboard/CodexSevenDayWindowUseCase';

export type CodexRolloutRateLimitReadResult = {
  observation: CodexSevenDayRateLimitObservation | null;
  errorMessages: string[];
};

export type CodexRolloutRateLimitRepository = {
  readLatestSevenDayRateLimit: (
    codexHomeDirectory: string,
  ) => CodexRolloutRateLimitReadResult;
};
