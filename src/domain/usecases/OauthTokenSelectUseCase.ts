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
  unifiedRejected: boolean;
  fableRejected: boolean;
  selectionWeight?: number;
};

export type SelectionRandom = () => number;

export const DEFAULT_SELECTION_WEIGHT = 1;

export const selectionWeightOf = (candidate: OauthTokenCandidate): number => {
  const weight = candidate.selectionWeight ?? DEFAULT_SELECTION_WEIGHT;
  return weight > 0 ? weight : 0;
};

export type OauthTokenCandidateMetrics = {
  name: string;
  fiveHourFreeRatio: number;
  sevenDayFreeRatio: number;
  sevenDayEndEpoch: number;
  eligible: boolean;
  exclusionReason: string | null;
  drawWeight: number;
};

export type OauthTokenSelectResult = {
  selected: OauthTokenCandidate | null;
  metrics: OauthTokenCandidateMetrics[];
};

const SECONDS_PER_DAY = 86400;
const SEVEN_DAYS_IN_SECONDS = 7 * SECONDS_PER_DAY;

export const FIVE_HOUR_MIN_FREE_RATIO = 0.25;
export const SEVEN_DAY_MIN_FREE_RATIO = 0.03;

export const SEVEN_DAY_WINDOW_HOURS = 168;
export const MIN_HOURS_TO_RESET = 1;
const SECONDS_PER_HOUR = 3600;

export const sevenDayUrgencyFactor = (
  sevenDayFreeRatio: number,
  sevenDayEndEpoch: number,
  nowEpochSeconds: number,
): number => {
  const hoursToReset = Math.max(
    (sevenDayEndEpoch - nowEpochSeconds) / SECONDS_PER_HOUR,
    MIN_HOURS_TO_RESET,
  );
  return sevenDayFreeRatio * (SEVEN_DAY_WINDOW_HOURS / hoursToReset);
};

export const selectWeightedCandidate = <Entry>(
  eligible: Entry[],
  weightOf: (entry: Entry) => number,
  deterministicBest: Entry,
  random: SelectionRandom,
): Entry => {
  if (eligible.length <= 1) {
    return deterministicBest;
  }
  const weights = eligible.map((entry) => Math.max(weightOf(entry), 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const uniform = weights.every((weight) => weight === weights[0]);
  if (uniform || totalWeight <= 0) {
    return deterministicBest;
  }
  let threshold = random() * totalWeight;
  for (let index = 0; index < eligible.length; index += 1) {
    threshold -= weights[index];
    if (threshold < 0) {
      return eligible[index];
    }
  }
  return eligible[eligible.length - 1];
};

export class OauthTokenSelectUseCase {
  run = (
    candidates: OauthTokenCandidate[],
    nowEpochSeconds: number,
    random: SelectionRandom = Math.random,
  ): OauthTokenSelectResult => {
    const evaluated = candidates.map((candidate) => ({
      candidate,
      metric: this.evaluate(candidate, nowEpochSeconds),
    }));

    const eligible = evaluated.filter((entry) => entry.metric.eligible);
    const metrics = evaluated.map((entry) => ({
      ...entry.metric,
      drawWeight: entry.metric.eligible
        ? selectionWeightOf(entry.candidate) *
          sevenDayUrgencyFactor(
            entry.metric.sevenDayFreeRatio,
            entry.metric.sevenDayEndEpoch,
            nowEpochSeconds,
          )
        : 0,
    }));

    if (eligible.length === 0) {
      return { selected: null, metrics };
    }

    const deterministicBest = eligible.reduce((bestEntry, currentEntry) =>
      currentEntry.metric.sevenDayEndEpoch < bestEntry.metric.sevenDayEndEpoch
        ? currentEntry
        : bestEntry,
    );

    const selected = selectWeightedCandidate(
      eligible,
      (entry) =>
        selectionWeightOf(entry.candidate) *
        sevenDayUrgencyFactor(
          entry.metric.sevenDayFreeRatio,
          entry.metric.sevenDayEndEpoch,
          nowEpochSeconds,
        ),
      deterministicBest,
      random,
    );

    return { selected: selected.candidate, metrics };
  };

  private evaluate = (
    candidate: OauthTokenCandidate,
    nowEpochSeconds: number,
  ): Omit<OauthTokenCandidateMetrics, 'drawWeight'> => {
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
      candidate.unifiedRejected,
      candidate.fableRejected,
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
    unifiedRejected: boolean,
    fableRejected: boolean,
    fiveHourFreeRatio: number,
    sevenDayFreeRatio: number,
  ): string | null => {
    if (subscriptionDisabled) {
      return 'organization has disabled Claude subscription access for Claude Code';
    }
    if (unifiedRejected) {
      return 'token request was rejected (anthropic-ratelimit-unified-status: rejected)';
    }
    if (fableRejected) {
      return 'fable weekly limit exhausted (a fable request was rejected with HTTP 429)';
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
