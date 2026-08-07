import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  OauthTokenCandidate,
  OauthTokenSelectUseCase,
  selectionWeightOf,
} from './OauthTokenSelectUseCase';

export const LIVE_SESSION_MAX_CONCURRENT_LIMIT = 4;
export const LIVE_SESSION_THROTTLE_START_FREE_RATIO = 0.6;
export const LIVE_SESSION_HORIZON_SECONDS = 5 * 3600;

export const sevenDayFreeRatioForLimit = (
  sevenDayFreeRatio: number,
  sevenDayEndEpoch: number,
  nowEpochSeconds: number,
): number =>
  sevenDayEndEpoch - nowEpochSeconds <= LIVE_SESSION_HORIZON_SECONDS
    ? 1
    : sevenDayFreeRatio;

export const liveSessionConcurrentLimitOf = (
  fiveHourFreeRatio: number,
  sevenDayFreeRatio: number,
  selectionWeight: number,
): number => {
  const taperOf = (freeRatio: number): number =>
    Math.min(freeRatio / LIVE_SESSION_THROTTLE_START_FREE_RATIO, 1);
  const taper = Math.min(
    taperOf(fiveHourFreeRatio),
    taperOf(sevenDayFreeRatio),
  );
  return Math.max(
    Math.floor(LIVE_SESSION_MAX_CONCURRENT_LIMIT * selectionWeight * taper),
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
        sevenDayFreeRatioForLimit(
          rateLimitMetric.sevenDayFreeRatio,
          rateLimitMetric.sevenDayEndEpoch,
          nowEpochSeconds,
        ),
        selectionWeightOf(candidate),
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
          eligible: rateLimitMetric.eligible,
          exclusionReason: rateLimitMetric.exclusionReason,
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
