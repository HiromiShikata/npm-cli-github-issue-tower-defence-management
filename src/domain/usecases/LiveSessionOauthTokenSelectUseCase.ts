import type { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  FIVE_HOUR_SPEND_DEADLINE_HOURS,
  type OauthTokenCandidate,
  OauthTokenSelectUseCase,
  type OauthTokenWindowSnapshot,
  SEVEN_DAY_SPEND_DEADLINE_HOURS,
  selectionWeightOf,
  sevenDayUrgencyFactor,
} from './OauthTokenSelectUseCase';

export const LIVE_SESSION_FALLBACK_SEVEN_DAY_MIN_FREE_RATIO = 0.03;

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

export type LiveSessionOauthTokenCandidateMetrics = {
  name: string;
  fiveHourFreeRatio: number;
  sevenDayFreeRatio: number;
  sevenDayEndEpoch: number;
  liveSessionCount: number;
  concurrentSessionLimit: number;
  hasConcurrencyHeadroom: boolean;
  eligible: boolean;
  exclusionReason: string | null;
  selectionWeight: number;
};

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
      const snapshot = candidate.snapshot;
      const sevenDayDeadlinePassed =
        snapshot !== null &&
        snapshot.sevenDayReset > 0 &&
        nowEpochSeconds >=
          snapshot.sevenDayReset - SEVEN_DAY_SPEND_DEADLINE_HOURS * 3600;
      const fiveHourDeadlinePassed =
        snapshot !== null &&
        snapshot.fiveHourReset > 0 &&
        nowEpochSeconds >=
          snapshot.fiveHourReset - FIVE_HOUR_SPEND_DEADLINE_HOURS * 3600;
      const exclusionReason = this.liveSessionExclusionReason(
        rateLimitMetric.exclusionReason,
        rateLimitMetric.fiveHourFreeRatio,
        rateLimitMetric.sevenDayFreeRatio,
        settings,
        fiveHourDeadlinePassed,
        sevenDayDeadlinePassed,
      );
      return {
        candidate,
        metric: {
          name: rateLimitMetric.name,
          fiveHourFreeRatio: rateLimitMetric.fiveHourFreeRatio,
          sevenDayFreeRatio: rateLimitMetric.sevenDayFreeRatio,
          sevenDayEndEpoch: rateLimitMetric.sevenDayEndEpoch,
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
    const eligible = evaluated.filter((entry) => entry.metric.eligible);

    if (eligible.length === 0) {
      const fallbackEligible = evaluated.filter(
        (entry) =>
          !entry.candidate.subscriptionDisabled &&
          !entry.candidate.unifiedRejected &&
          !entry.candidate.fableRejected &&
          Math.round(entry.metric.sevenDayFreeRatio * 100) >
            Math.round(LIVE_SESSION_FALLBACK_SEVEN_DAY_MIN_FREE_RATIO * 100),
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

    const selected = eligible.reduce((bestEntry, currentEntry) =>
      this.preferred(currentEntry.metric, bestEntry.metric)
        ? currentEntry
        : bestEntry,
    );

    return { selected: selected.candidate, metrics };
  };

  private liveSessionExclusionReason = (
    rateLimitExclusionReason: string | null,
    fiveHourFreeRatio: number,
    sevenDayFreeRatio: number,
    settings: LiveSessionOauthTokenSelectionSettings,
    fiveHourDeadlinePassed: boolean,
    sevenDayDeadlinePassed: boolean,
  ): string | null => {
    if (rateLimitExclusionReason !== null) {
      return rateLimitExclusionReason;
    }
    if (
      !fiveHourDeadlinePassed &&
      fiveHourFreeRatio < settings.minFiveHourFreeRatio
    ) {
      return `5h window only ${Math.round(fiveHourFreeRatio * 100)}% free (requires >= ${Math.round(settings.minFiveHourFreeRatio * 100)}% for live session selection)`;
    }
    if (
      !sevenDayDeadlinePassed &&
      sevenDayFreeRatio < settings.minSevenDayFreeRatio
    ) {
      return `7d window only ${Math.round(sevenDayFreeRatio * 100)}% free (requires >= ${Math.round(settings.minSevenDayFreeRatio * 100)}% for live session selection)`;
    }
    if (
      sevenDayDeadlinePassed &&
      Math.round(sevenDayFreeRatio * 100) <=
        Math.round(LIVE_SESSION_FALLBACK_SEVEN_DAY_MIN_FREE_RATIO * 100)
    ) {
      return `7d window only ${Math.round(sevenDayFreeRatio * 100)}% free (budget exhausted; token ineligible even within 48-hour deadline window)`;
    }
    return null;
  };

  private preferred = (
    candidateMetric: LiveSessionOauthTokenCandidateMetrics,
    incumbentMetric: LiveSessionOauthTokenCandidateMetrics,
  ): boolean => {
    if (
      candidateMetric.hasConcurrencyHeadroom !==
      incumbentMetric.hasConcurrencyHeadroom
    ) {
      return candidateMetric.hasConcurrencyHeadroom;
    }
    if (!candidateMetric.hasConcurrencyHeadroom) {
      const candidateOccupancyRatio =
        occupancyRatioAfterOneMoreSessionOf(candidateMetric);
      const incumbentOccupancyRatio =
        occupancyRatioAfterOneMoreSessionOf(incumbentMetric);
      if (candidateOccupancyRatio !== incumbentOccupancyRatio) {
        return candidateOccupancyRatio < incumbentOccupancyRatio;
      }
    }
    if (candidateMetric.sevenDayEndEpoch !== incumbentMetric.sevenDayEndEpoch) {
      return (
        candidateMetric.sevenDayEndEpoch < incumbentMetric.sevenDayEndEpoch
      );
    }
    return candidateMetric.liveSessionCount < incumbentMetric.liveSessionCount;
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
