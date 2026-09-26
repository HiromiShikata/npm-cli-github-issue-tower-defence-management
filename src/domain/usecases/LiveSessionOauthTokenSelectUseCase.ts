import type { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  type OauthTokenCandidate,
  OauthTokenSelectUseCase,
  type OauthTokenSelectionThresholds,
  type OauthTokenWindowSnapshot,
  SEVEN_DAY_SPEND_DEADLINE_HOURS,
  selectionWeightOf,
  sevenDayUrgencyFactor,
} from './OauthTokenSelectUseCase';

export const SEVEN_DAY_SHARE_CONSUMED_PER_FULLY_SPENT_FIVE_HOUR_WINDOW = 0.14;

const RATE_LIMIT_SELECTION_THRESHOLDS_THAT_EXCLUDE_NO_FREE_RATIO: OauthTokenSelectionThresholds =
  {
    fiveHourMinFreeRatio: 0,
    sevenDayMinFreeRatio: 0,
  };

export type LiveSessionOauthTokenSelectionSettings = {
  maxConcurrentSessionCount: number;
  fullSpeedFiveHourFreeRatio: number;
  minFiveHourFreeRatio: number;
  minSevenDayFreeRatio: number;
  fiveHourShareConsumedPerSessionHour: number;
};

export const DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS: LiveSessionOauthTokenSelectionSettings =
  {
    maxConcurrentSessionCount: 10,
    fullSpeedFiveHourFreeRatio: 0.5,
    minFiveHourFreeRatio: 0.6,
    minSevenDayFreeRatio: 0.14,
    fiveHourShareConsumedPerSessionHour: 0.05,
  };

const FIVE_HOUR_WINDOW_LENGTH_HOURS = 5;
const SECONDS_PER_HOUR = 3600;

export const fiveHourSustainableSessionCountOf = (
  fiveHourFreeRatio: number,
  hoursUntilFiveHourReset: number,
  settings: LiveSessionOauthTokenSelectionSettings,
): number => {
  const fiveHourShareSpendablePerHour = Math.min(
    fiveHourFreeRatio / hoursUntilFiveHourReset,
    1 / FIVE_HOUR_WINDOW_LENGTH_HOURS,
  );
  return Math.max(
    1,
    Math.floor(
      fiveHourShareSpendablePerHour /
        settings.fiveHourShareConsumedPerSessionHour,
    ),
  );
};

const hoursUntilFiveHourResetOf = (
  snapshot: OauthTokenWindowSnapshot | null,
  nowEpochSeconds: number,
): number => {
  if (snapshot === null || snapshot.fiveHourReset <= nowEpochSeconds) {
    return FIVE_HOUR_WINDOW_LENGTH_HOURS;
  }
  return (snapshot.fiveHourReset - nowEpochSeconds) / SECONDS_PER_HOUR;
};

const occupancyRatioAfterOneMoreSessionOf = (
  metric: LiveSessionOauthTokenCandidateMetrics,
): number => (metric.liveSessionCount + 1) / metric.concurrentSessionLimit;

export const liveSessionConcurrentLimitOf = (
  fiveHourFreeRatio: number,
  selectionWeight: number,
  settings: LiveSessionOauthTokenSelectionSettings,
  sevenDayUrgencyBoost = 1,
): number => {
  const fiveHourThrottleFactor = Math.min(
    fiveHourFreeRatio / settings.fullSpeedFiveHourFreeRatio,
    1,
  );
  const unfloredScore =
    settings.maxConcurrentSessionCount *
    selectionWeight *
    fiveHourThrottleFactor;
  if (unfloredScore < 1) {
    return 1;
  }
  const base = Math.floor(unfloredScore);
  if (sevenDayUrgencyBoost <= 1) {
    return base;
  }
  return Math.min(
    Math.floor(base * sevenDayUrgencyBoost),
    settings.maxConcurrentSessionCount,
  );
};

export const sevenDayShareDrainableBeforeSpendDeadlineOf = (
  sevenDayEndEpoch: number,
  nowEpochSeconds: number,
  settings: LiveSessionOauthTokenSelectionSettings,
): number => {
  const hoursUntilSevenDaySpendDeadline = Math.max(
    (sevenDayEndEpoch - nowEpochSeconds) / SECONDS_PER_HOUR -
      SEVEN_DAY_SPEND_DEADLINE_HOURS,
    0,
  );
  const fiveHourShareSpentPerHourAtMaxConcurrency = Math.min(
    settings.maxConcurrentSessionCount *
      settings.fiveHourShareConsumedPerSessionHour,
    1 / FIVE_HOUR_WINDOW_LENGTH_HOURS,
  );
  return (
    hoursUntilSevenDaySpendDeadline *
    fiveHourShareSpentPerHourAtMaxConcurrency *
    SEVEN_DAY_SHARE_CONSUMED_PER_FULLY_SPENT_FIVE_HOUR_WINDOW
  );
};

export const sevenDayBudgetUndrainableBeforeSpendDeadlineOf = (
  sevenDayFreeRatio: number,
  sevenDayEndEpoch: number,
  nowEpochSeconds: number,
  settings: LiveSessionOauthTokenSelectionSettings,
): boolean =>
  sevenDayFreeRatio >
  sevenDayShareDrainableBeforeSpendDeadlineOf(
    sevenDayEndEpoch,
    nowEpochSeconds,
    settings,
  );

export type LiveSessionOauthTokenCandidateMetrics = {
  name: string;
  fiveHourFreeRatio: number;
  sevenDayFreeRatio: number;
  sevenDayEndEpoch: number;
  sevenDayBudgetUndrainableBeforeSpendDeadline: boolean;
  liveSessionCount: number;
  concurrentSessionLimit: number;
  hasConcurrencyHeadroom: boolean;
  eligible: boolean;
  exclusionReason: string | null;
  selectionWeight: number;
};

export const liveSessionOauthTokenCandidateMetricsInSelectionOrder = (
  metrics: LiveSessionOauthTokenCandidateMetrics[],
): LiveSessionOauthTokenCandidateMetrics[] =>
  [...metrics].sort((left, right) => {
    if (
      left.sevenDayBudgetUndrainableBeforeSpendDeadline !==
      right.sevenDayBudgetUndrainableBeforeSpendDeadline
    ) {
      return left.sevenDayBudgetUndrainableBeforeSpendDeadline ? -1 : 1;
    }
    if (left.sevenDayFreeRatio !== right.sevenDayFreeRatio) {
      return left.sevenDayFreeRatio - right.sevenDayFreeRatio;
    }
    if (left.sevenDayEndEpoch !== right.sevenDayEndEpoch) {
      return left.sevenDayEndEpoch - right.sevenDayEndEpoch;
    }
    return left.liveSessionCount - right.liveSessionCount;
  });

export type LiveSessionOauthTokenSelectResult = {
  selected: OauthTokenCandidate | null;
  metrics: LiveSessionOauthTokenCandidateMetrics[];
};

export class LiveSessionOauthTokenSelectUseCase {
  constructor(
    private readonly rateLimitSelectUseCase: OauthTokenSelectUseCase = new OauthTokenSelectUseCase(),
  ) {}

  run = (
    candidates: OauthTokenCandidate[],
    liveSessions: ClaudeLiveSession[],
    nowEpochSeconds: number,
    settings: LiveSessionOauthTokenSelectionSettings,
  ): LiveSessionOauthTokenSelectResult => {
    const rateLimitResult = this.rateLimitSelectUseCase.run(
      candidates,
      nowEpochSeconds,
      () => 0,
      RATE_LIMIT_SELECTION_THRESHOLDS_THAT_EXCLUDE_NO_FREE_RATIO,
    );
    const liveSessionCountByToken = this.liveSessionCountByToken(liveSessions);

    const evaluated = candidates.map((candidate, index) => {
      const rateLimitMetric = rateLimitResult.metrics[index];
      const liveSessionCount =
        liveSessionCountByToken.get(candidate.token) ?? 0;
      const urgencyBoost = sevenDayUrgencyFactor(
        rateLimitMetric.sevenDayFreeRatio,
        rateLimitMetric.sevenDayEndEpoch,
        nowEpochSeconds,
      );
      const concurrentSessionLimit = Math.min(
        liveSessionConcurrentLimitOf(
          rateLimitMetric.fiveHourFreeRatio,
          selectionWeightOf(candidate),
          settings,
          urgencyBoost,
        ),
        fiveHourSustainableSessionCountOf(
          rateLimitMetric.fiveHourFreeRatio,
          hoursUntilFiveHourResetOf(candidate.snapshot, nowEpochSeconds),
          settings,
        ),
      );
      const exclusionReason = rateLimitMetric.exclusionReason;
      return {
        candidate,
        metric: {
          name: rateLimitMetric.name,
          fiveHourFreeRatio: rateLimitMetric.fiveHourFreeRatio,
          sevenDayFreeRatio: rateLimitMetric.sevenDayFreeRatio,
          sevenDayEndEpoch: rateLimitMetric.sevenDayEndEpoch,
          sevenDayBudgetUndrainableBeforeSpendDeadline:
            sevenDayBudgetUndrainableBeforeSpendDeadlineOf(
              rateLimitMetric.sevenDayFreeRatio,
              rateLimitMetric.sevenDayEndEpoch,
              nowEpochSeconds,
              settings,
            ),
          liveSessionCount,
          concurrentSessionLimit,
          hasConcurrencyHeadroom: liveSessionCount < concurrentSessionLimit,
          eligible: exclusionReason === null,
          exclusionReason,
          selectionWeight: selectionWeightOf(candidate),
        },
      };
    });

    const metrics = evaluated.map((entry) => entry.metric);
    const candidateByMetric = new Map(
      evaluated.map((entry) => [entry.metric, entry.candidate]),
    );
    const eligibleMetricsInSelectionOrder =
      liveSessionOauthTokenCandidateMetricsInSelectionOrder(
        metrics.filter((metric) => metric.eligible),
      );

    if (eligibleMetricsInSelectionOrder.length === 0) {
      const fallbackEligible = evaluated.filter(
        (entry) =>
          !entry.candidate.subscriptionDisabled &&
          !entry.candidate.unifiedRejected &&
          !entry.candidate.fableRejected,
      );

      if (fallbackEligible.length === 0) {
        return { selected: null, metrics };
      }

      const fallbackSelected = fallbackEligible.reduce(
        (bestEntry, currentEntry) => {
          if (
            currentEntry.metric.fiveHourFreeRatio >
            bestEntry.metric.fiveHourFreeRatio
          ) {
            return currentEntry;
          }
          if (
            currentEntry.metric.fiveHourFreeRatio ===
              bestEntry.metric.fiveHourFreeRatio &&
            currentEntry.metric.liveSessionCount <
              bestEntry.metric.liveSessionCount
          ) {
            return currentEntry;
          }
          return bestEntry;
        },
      );

      return { selected: fallbackSelected.candidate, metrics };
    }

    const selectedMetric =
      eligibleMetricsInSelectionOrder.find(
        (metric) => metric.hasConcurrencyHeadroom,
      ) ??
      eligibleMetricsInSelectionOrder.reduce((leastOccupied, current) =>
        occupancyRatioAfterOneMoreSessionOf(current) <
        occupancyRatioAfterOneMoreSessionOf(leastOccupied)
          ? current
          : leastOccupied,
      );

    return {
      selected: candidateByMetric.get(selectedMetric) ?? null,
      metrics,
    };
  };

  private liveSessionCountByToken = (
    liveSessions: ClaudeLiveSession[],
  ): Map<string, number> => {
    const sessionKeysByToken = new Map<string, Set<string>>();
    for (const liveSession of liveSessions) {
      const sessionKeys =
        sessionKeysByToken.get(liveSession.token) ?? new Set<string>();
      sessionKeys.add(liveSession.sessionKey);
      sessionKeysByToken.set(liveSession.token, sessionKeys);
    }
    const countByToken = new Map<string, number>();
    for (const [token, sessionKeys] of sessionKeysByToken.entries()) {
      countByToken.set(token, sessionKeys.size);
    }
    return countByToken;
  };
}
