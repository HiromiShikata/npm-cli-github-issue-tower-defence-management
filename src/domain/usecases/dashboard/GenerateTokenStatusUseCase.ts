export type TokenStatusColor = 'G' | 'Y' | 'K' | 'R';

export type TokenRateLimitSnapshot = {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
  blocked: boolean;
  fiveHourRejected: boolean;
  sevenDayRejected: boolean;
  unifiedStatus: string | null;
  sevenDaySonnetRejected: boolean;
  sevenDayOpusRejected: boolean;
  hasWindowData: boolean;
  lastUpdatedEpoch: number;
  subscriptionDisabled: boolean;
};

export type TokenRateLimitDecision = {
  subscriptionDisabled: boolean;
  fiveHourUtilization: number | null;
  sevenDayUtilization: number | null;
  fiveHourRejected: boolean;
  sevenDayRejected: boolean;
  blocked: boolean;
  unifiedStatus: string | null;
  sevenDaySonnetRejected: boolean;
  sevenDayOpusRejected: boolean;
  partial: boolean;
};

export type TokenStatus = {
  name: string;
  fiveHourUtilizationPercent: number | null;
  fiveHourResetSeconds: number | null;
  sevenDayUtilizationPercent: number | null;
  sevenDayResetSeconds: number | null;
  color: TokenStatusColor;
  prep: number;
  hum: number;
};

export type SevenDayWindowAggregate = {
  usedPercent: number;
  includedTokenCount: number;
  totalTokenCount: number;
};

export type TokenStatusInput = {
  name: string;
  token: string;
  snapshot: TokenRateLimitSnapshot | null;
};

export type GenerateTokenStatusInput = {
  tokens: TokenStatusInput[];
  prepCountByToken: Map<string, number>;
  humCountByToken: Map<string, number>;
  nowEpochSeconds: number;
};

const HIGH_UTILIZATION_THRESHOLD = 0.7;
const ALLOWED_WARNING_STATUS = 'allowed_warning';

export const judgeTokenColor = (
  decision: TokenRateLimitDecision | null,
): TokenStatusColor => {
  if (decision !== null && decision.subscriptionDisabled) {
    return 'R';
  }
  if (decision === null || decision.partial) {
    return 'Y';
  }
  const fiveHourUtilization = decision.fiveHourUtilization ?? 0;
  const sevenDayUtilization = decision.sevenDayUtilization ?? 0;
  const fiveHourExhausted =
    fiveHourUtilization >= 1.0 || decision.fiveHourRejected;
  const generalSevenDayRejected = decision.sevenDayRejected;
  const bothModelsSevenDayRejected =
    decision.sevenDaySonnetRejected && decision.sevenDayOpusRejected;
  const noModelUsable =
    decision.blocked ||
    fiveHourExhausted ||
    generalSevenDayRejected ||
    bothModelsSevenDayRejected;
  if (noModelUsable) {
    return 'K';
  }
  if (decision.unifiedStatus === ALLOWED_WARNING_STATUS) {
    return 'Y';
  }
  if (
    fiveHourUtilization >= HIGH_UTILIZATION_THRESHOLD ||
    sevenDayUtilization >= HIGH_UTILIZATION_THRESHOLD
  ) {
    return 'Y';
  }
  return 'G';
};

export const computeSevenDayWindowAggregate = (
  tokens: TokenStatus[],
): SevenDayWindowAggregate | null => {
  const utilizations = tokens
    .map((token) => token.sevenDayUtilizationPercent)
    .filter((percent): percent is number => percent !== null);
  if (utilizations.length === 0) {
    return null;
  }
  const total = utilizations.reduce((sum, percent) => sum + percent, 0);
  return {
    usedPercent: total / utilizations.length,
    includedTokenCount: utilizations.length,
    totalTokenCount: tokens.length,
  };
};

export class GenerateTokenStatusUseCase {
  run = (input: GenerateTokenStatusInput): TokenStatus[] => {
    const { tokens, prepCountByToken, humCountByToken, nowEpochSeconds } =
      input;
    return tokens.map((tokenInput) => {
      const decision = this.toDecision(tokenInput.snapshot, nowEpochSeconds);
      const normalized = this.normalizeWindows(
        tokenInput.snapshot,
        nowEpochSeconds,
      );
      return {
        name: tokenInput.name,
        fiveHourUtilizationPercent: normalized.fiveHourUtilizationPercent,
        fiveHourResetSeconds: normalized.fiveHourResetSeconds,
        sevenDayUtilizationPercent: normalized.sevenDayUtilizationPercent,
        sevenDayResetSeconds: normalized.sevenDayResetSeconds,
        color: judgeTokenColor(decision),
        prep: prepCountByToken.get(tokenInput.token) ?? 0,
        hum: humCountByToken.get(tokenInput.token) ?? 0,
      };
    });
  };

  private normalizeWindows = (
    snapshot: TokenRateLimitSnapshot | null,
    nowEpochSeconds: number,
  ): {
    fiveHourUtilizationPercent: number | null;
    fiveHourResetSeconds: number | null;
    sevenDayUtilizationPercent: number | null;
    sevenDayResetSeconds: number | null;
  } => {
    if (snapshot === null || !snapshot.hasWindowData) {
      return {
        fiveHourUtilizationPercent: null,
        fiveHourResetSeconds: null,
        sevenDayUtilizationPercent: null,
        sevenDayResetSeconds: null,
      };
    }
    const fiveHourReset =
      snapshot.fiveHourReset > 0 ? snapshot.fiveHourReset : null;
    const sevenDayReset =
      snapshot.sevenDayReset > 0 ? snapshot.sevenDayReset : null;
    const fiveHourExpired =
      fiveHourReset !== null &&
      fiveHourReset < nowEpochSeconds &&
      snapshot.lastUpdatedEpoch >= fiveHourReset;
    const sevenDayExpired =
      sevenDayReset !== null &&
      sevenDayReset < nowEpochSeconds &&
      snapshot.lastUpdatedEpoch >= sevenDayReset;
    return {
      fiveHourUtilizationPercent: fiveHourExpired
        ? 0
        : Math.trunc(snapshot.fiveHourUtilization * 100),
      fiveHourResetSeconds:
        fiveHourReset === null
          ? null
          : Math.max(0, fiveHourReset - nowEpochSeconds),
      sevenDayUtilizationPercent: sevenDayExpired
        ? 0
        : Math.trunc(snapshot.sevenDayUtilization * 100),
      sevenDayResetSeconds:
        sevenDayReset === null
          ? null
          : Math.max(0, sevenDayReset - nowEpochSeconds),
    };
  };

  private toDecision = (
    snapshot: TokenRateLimitSnapshot | null,
    nowEpochSeconds: number,
  ): TokenRateLimitDecision | null => {
    if (snapshot === null) {
      return null;
    }
    if (!snapshot.hasWindowData) {
      return {
        fiveHourUtilization: null,
        sevenDayUtilization: null,
        fiveHourRejected: snapshot.fiveHourRejected,
        sevenDayRejected: snapshot.sevenDayRejected,
        blocked: snapshot.blocked,
        unifiedStatus: snapshot.unifiedStatus,
        sevenDaySonnetRejected: snapshot.sevenDaySonnetRejected,
        sevenDayOpusRejected: snapshot.sevenDayOpusRejected,
        partial: true,
        subscriptionDisabled: snapshot.subscriptionDisabled,
      };
    }
    const fiveHourExpired =
      snapshot.fiveHourReset > 0 &&
      snapshot.fiveHourReset < nowEpochSeconds &&
      snapshot.lastUpdatedEpoch >= snapshot.fiveHourReset;
    const sevenDayExpired =
      snapshot.sevenDayReset > 0 &&
      snapshot.sevenDayReset < nowEpochSeconds &&
      snapshot.lastUpdatedEpoch >= snapshot.sevenDayReset;
    return {
      fiveHourUtilization: fiveHourExpired ? 0 : snapshot.fiveHourUtilization,
      sevenDayUtilization: sevenDayExpired ? 0 : snapshot.sevenDayUtilization,
      fiveHourRejected: fiveHourExpired ? false : snapshot.fiveHourRejected,
      sevenDayRejected: sevenDayExpired ? false : snapshot.sevenDayRejected,
      blocked: snapshot.blocked,
      unifiedStatus: snapshot.unifiedStatus,
      sevenDaySonnetRejected:
        snapshot.sevenDaySonnetRejected ||
        (sevenDayExpired ? false : snapshot.sevenDayRejected),
      sevenDayOpusRejected:
        snapshot.sevenDayOpusRejected ||
        (sevenDayExpired ? false : snapshot.sevenDayRejected),
      partial: false,
      subscriptionDisabled: snapshot.subscriptionDisabled,
    };
  };
}
