import type { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  type OauthTokenCandidate,
  OauthTokenSelectUseCase,
  selectionWeightOf,
} from './OauthTokenSelectUseCase';

export type LiveSessionOauthTokenSelectionSettings = {
  maxConcurrentSessionCount: number;
  fullSpeedFiveHourFreeRatio: number;
  minFiveHourFreeRatio: number;
  minSevenDayFreeRatio: number;
};

export const DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS: LiveSessionOauthTokenSelectionSettings =
  {
    maxConcurrentSessionCount: 10,
    fullSpeedFiveHourFreeRatio: 0.5,
    minFiveHourFreeRatio: 0.6,
    minSevenDayFreeRatio: 0.14,
  };

export const liveSessionConcurrentLimitOf = (
  fiveHourFreeRatio: number,
  selectionWeight: number,
  settings: LiveSessionOauthTokenSelectionSettings,
): number => {
  const fiveHourThrottleFactor = Math.min(
    fiveHourFreeRatio / settings.fullSpeedFiveHourFreeRatio,
    1,
  );
  return Math.max(
    Math.floor(
      settings.maxConcurrentSessionCount *
        selectionWeight *
        fiveHourThrottleFactor,
    ),
    1,
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
      const concurrentSessionLimit = liveSessionConcurrentLimitOf(
        rateLimitMetric.fiveHourFreeRatio,
        selectionWeightOf(candidate),
        settings,
      );
      const exclusionReason = this.liveSessionExclusionReason(
        rateLimitMetric.exclusionReason,
        rateLimitMetric.fiveHourFreeRatio,
        rateLimitMetric.sevenDayFreeRatio,
        settings,
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
      return { selected: null, metrics };
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
  ): string | null => {
    if (rateLimitExclusionReason !== null) {
      return rateLimitExclusionReason;
    }
    if (fiveHourFreeRatio < settings.minFiveHourFreeRatio) {
      return `5h window only ${Math.round(fiveHourFreeRatio * 100)}% free (requires >= ${Math.round(settings.minFiveHourFreeRatio * 100)}% for CL script selection)`;
    }
    if (sevenDayFreeRatio < settings.minSevenDayFreeRatio) {
      return `7d window only ${Math.round(sevenDayFreeRatio * 100)}% free (requires >= ${Math.round(settings.minSevenDayFreeRatio * 100)}% for CL script selection)`;
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
