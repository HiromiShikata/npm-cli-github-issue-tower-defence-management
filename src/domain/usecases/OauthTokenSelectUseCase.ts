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

export type OauthTokenSelectionThresholds = {
  fiveHourMinFreeRatio: number;
  sevenDayMinFreeRatio: number;
};

const SECONDS_PER_DAY = 86400;
const SEVEN_DAYS_IN_SECONDS = 7 * SECONDS_PER_DAY;

export const FIVE_HOUR_MIN_FREE_RATIO = 0.25;
export const SEVEN_DAY_MIN_FREE_RATIO = 0.01;

export const DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS: OauthTokenSelectionThresholds =
  {
    fiveHourMinFreeRatio: FIVE_HOUR_MIN_FREE_RATIO,
    sevenDayMinFreeRatio: SEVEN_DAY_MIN_FREE_RATIO,
  };

export const CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS: OauthTokenSelectionThresholds =
  {
    fiveHourMinFreeRatio: 0.6,
    sevenDayMinFreeRatio: 0.14,
  };

export const SEVEN_DAY_WINDOW_HOURS = 168;
export const MIN_HOURS_TO_RESET = 1;
export const SEVEN_DAY_SPEND_DEADLINE_HOURS = 24;
export const FIVE_HOUR_SPEND_DEADLINE_HOURS = 1;
const SECONDS_PER_HOUR = 3600;

export const sevenDayUrgencyFactor = (
  sevenDayFreeRatio: number,
  sevenDayEndEpoch: number,
  nowEpochSeconds: number,
): number => {
  const hoursToReset = (sevenDayEndEpoch - nowEpochSeconds) / SECONDS_PER_HOUR;
  const hoursToDeadline = Math.max(
    hoursToReset - SEVEN_DAY_SPEND_DEADLINE_HOURS,
    MIN_HOURS_TO_RESET,
  );
  return sevenDayFreeRatio * (SEVEN_DAY_WINDOW_HOURS / hoursToDeadline);
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
    thresholds: OauthTokenSelectionThresholds = DEFAULT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
  ): OauthTokenSelectResult => {
    const evaluated = candidates.map((candidate) => {
      const evaluatedMetric = this.evaluate(
        candidate,
        nowEpochSeconds,
        thresholds,
      );
      return {
        candidate,
        metric: {
          ...evaluatedMetric,
          drawWeight: evaluatedMetric.eligible
            ? selectionWeightOf(candidate) *
              sevenDayUrgencyFactor(
                evaluatedMetric.sevenDayFreeRatio,
                evaluatedMetric.sevenDayEndEpoch,
                nowEpochSeconds,
              )
            : 0,
        },
      };
    });

    const eligible = evaluated.filter((entry) => entry.metric.eligible);
    const metrics = evaluated.map((entry) => entry.metric);

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
      (entry) => entry.metric.drawWeight,
      deterministicBest,
      random,
    );

    return { selected: selected.candidate, metrics };
  };

  private evaluate = (
    candidate: OauthTokenCandidate,
    nowEpochSeconds: number,
    thresholds: OauthTokenSelectionThresholds,
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
    const fiveHourDeadlinePassed =
      candidate.snapshot !== null &&
      this.deadlinePassed(
        candidate.snapshot.fiveHourReset,
        FIVE_HOUR_SPEND_DEADLINE_HOURS,
        nowEpochSeconds,
      );
    const sevenDayDeadlinePassed =
      candidate.snapshot !== null &&
      this.deadlinePassed(
        candidate.snapshot.sevenDayReset,
        SEVEN_DAY_SPEND_DEADLINE_HOURS,
        nowEpochSeconds,
      );

    const exclusionReason = this.exclusionReason(
      candidate.subscriptionDisabled,
      candidate.unifiedRejected,
      candidate.fableRejected,
      fiveHourFreeRatio,
      sevenDayFreeRatio,
      thresholds,
      fiveHourDeadlinePassed,
      sevenDayDeadlinePassed,
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
    thresholds: OauthTokenSelectionThresholds,
    fiveHourDeadlinePassed: boolean,
    sevenDayDeadlinePassed: boolean,
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
    if (
      !fiveHourDeadlinePassed &&
      fiveHourFreeRatio < thresholds.fiveHourMinFreeRatio
    ) {
      return `5h window only ${this.toPercent(fiveHourFreeRatio)}% free (requires >= ${this.toPercent(thresholds.fiveHourMinFreeRatio)}%)`;
    }
    if (
      !sevenDayDeadlinePassed &&
      sevenDayFreeRatio < thresholds.sevenDayMinFreeRatio
    ) {
      return `7d window only ${this.toPercent(sevenDayFreeRatio)}% free (requires >= ${this.toPercent(thresholds.sevenDayMinFreeRatio)}%)`;
    }
    return null;
  };

  private deadlinePassed = (
    resetEpoch: number,
    deadlineHours: number,
    nowEpochSeconds: number,
  ): boolean =>
    resetEpoch > 0 &&
    nowEpochSeconds >= resetEpoch - deadlineHours * SECONDS_PER_HOUR;

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
