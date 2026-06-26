export type TokenStatusColor = 'G' | 'Y' | 'K';

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
};

export type TokenRateLimitDecision = {
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
      fiveHourReset !== null && fiveHourReset < nowEpochSeconds;
    const sevenDayExpired =
      sevenDayReset !== null && sevenDayReset < nowEpochSeconds;
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
      };
    }
    const fiveHourExpired =
      snapshot.fiveHourReset > 0 && snapshot.fiveHourReset < nowEpochSeconds;
    const sevenDayExpired =
      snapshot.sevenDayReset > 0 && snapshot.sevenDayReset < nowEpochSeconds;
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
    };
  };
}
