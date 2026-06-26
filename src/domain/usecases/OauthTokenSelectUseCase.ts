export type OauthTokenWindowSnapshot = {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
};

export type OauthTokenCandidate = {
  name: string;
  token: string;
  snapshot: OauthTokenWindowSnapshot | null;
  subscriptionDisabled: boolean;
};

export type OauthTokenCandidateMetrics = {
  name: string;
  fiveHourFreeRatio: number;
  sevenDayFreeRatio: number;
  sevenDayEndEpoch: number;
  eligible: boolean;
  exclusionReason: string | null;
};

export type OauthTokenSelectResult = {
  selected: OauthTokenCandidate | null;
  metrics: OauthTokenCandidateMetrics[];
};

const SECONDS_PER_DAY = 86400;
const SEVEN_DAYS_IN_SECONDS = 7 * SECONDS_PER_DAY;

export const FIVE_HOUR_MIN_FREE_RATIO = 0.6;
export const SEVEN_DAY_MIN_FREE_RATIO = 0.3;

export class OauthTokenSelectUseCase {
  run = (
    candidates: OauthTokenCandidate[],
    nowEpochSeconds: number,
  ): OauthTokenSelectResult => {
    const evaluated = candidates.map((candidate) => ({
      candidate,
      metric: this.evaluate(candidate, nowEpochSeconds),
    }));

    const metrics = evaluated.map((entry) => entry.metric);
    const eligible = evaluated.filter((entry) => entry.metric.eligible);

    if (eligible.length === 0) {
      return { selected: null, metrics };
    }

    const best = eligible.reduce((bestEntry, currentEntry) =>
      currentEntry.metric.sevenDayEndEpoch < bestEntry.metric.sevenDayEndEpoch
        ? currentEntry
        : bestEntry,
    );

    return { selected: best.candidate, metrics };
  };

  private evaluate = (
    candidate: OauthTokenCandidate,
    nowEpochSeconds: number,
  ): OauthTokenCandidateMetrics => {
    const fiveHourFreeRatio = this.fiveHourFreeRatio(
      candidate.snapshot,
      nowEpochSeconds,
    );
    const sevenDayFreeRatio = this.sevenDayFreeRatio(
      candidate.snapshot,
      nowEpochSeconds,
    );
    const sevenDayEndEpoch = this.sevenDayEndEpoch(
      candidate.snapshot,
      nowEpochSeconds,
    );

    const exclusionReason = this.exclusionReason(
      candidate.subscriptionDisabled,
      fiveHourFreeRatio,
      sevenDayFreeRatio,
    );

    return {
      name: candidate.name,
      fiveHourFreeRatio,
      sevenDayFreeRatio,
      sevenDayEndEpoch,
      eligible: exclusionReason === null,
      exclusionReason,
    };
  };

  private exclusionReason = (
    subscriptionDisabled: boolean,
    fiveHourFreeRatio: number,
    sevenDayFreeRatio: number,
  ): string | null => {
    if (subscriptionDisabled) {
      return 'organization has disabled Claude subscription access for Claude Code';
    }
    if (fiveHourFreeRatio < FIVE_HOUR_MIN_FREE_RATIO) {
      return `5h window only ${this.toPercent(fiveHourFreeRatio)}% free (requires >= ${this.toPercent(FIVE_HOUR_MIN_FREE_RATIO)}%)`;
    }
    if (sevenDayFreeRatio < SEVEN_DAY_MIN_FREE_RATIO) {
      return `7d window only ${this.toPercent(sevenDayFreeRatio)}% free (requires >= ${this.toPercent(SEVEN_DAY_MIN_FREE_RATIO)}%)`;
    }
    return null;
  };

  private fiveHourFreeRatio = (
    snapshot: OauthTokenWindowSnapshot | null,
    nowEpochSeconds: number,
  ): number => {
    if (snapshot === null) {
      return 1;
    }
    if (this.windowExpired(snapshot.fiveHourReset, nowEpochSeconds)) {
      return 1;
    }
    return this.freeRatioFromUtilization(snapshot.fiveHourUtilization);
  };

  private sevenDayFreeRatio = (
    snapshot: OauthTokenWindowSnapshot | null,
    nowEpochSeconds: number,
  ): number => {
    if (snapshot === null) {
      return 1;
    }
    if (this.windowExpired(snapshot.sevenDayReset, nowEpochSeconds)) {
      return 1;
    }
    return this.freeRatioFromUtilization(snapshot.sevenDayUtilization);
  };

  private sevenDayEndEpoch = (
    snapshot: OauthTokenWindowSnapshot | null,
    nowEpochSeconds: number,
  ): number => {
    if (snapshot === null) {
      return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
    }
    if (snapshot.sevenDayReset <= 0) {
      return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
    }
    if (this.windowExpired(snapshot.sevenDayReset, nowEpochSeconds)) {
      return nowEpochSeconds + SEVEN_DAYS_IN_SECONDS;
    }
    return snapshot.sevenDayReset;
  };

  private windowExpired = (
    resetEpoch: number,
    nowEpochSeconds: number,
  ): boolean => resetEpoch > 0 && nowEpochSeconds > resetEpoch;

  private freeRatioFromUtilization = (utilization: number): number => {
    const bounded = Math.min(Math.max(utilization, 0), 1);
    return 1 - bounded;
  };

  private toPercent = (ratio: number): number => Math.round(ratio * 100);
}
