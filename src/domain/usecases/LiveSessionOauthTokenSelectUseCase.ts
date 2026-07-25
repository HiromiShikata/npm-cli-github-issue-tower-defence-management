import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  OauthTokenCandidate,
  OauthTokenSelectUseCase,
  SelectionRandom,
  selectWeightedCandidate,
} from './OauthTokenSelectUseCase';

export type LiveSessionOauthTokenCandidateMetrics = {
  name: string;
  fiveHourFreeRatio: number;
  sevenDayFreeRatio: number;
  sevenDayEndEpoch: number;
  liveSessionCount: number;
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
    random: SelectionRandom = Math.random,
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
      return {
        candidate,
        metric: {
          name: rateLimitMetric.name,
          fiveHourFreeRatio: rateLimitMetric.fiveHourFreeRatio,
          sevenDayFreeRatio: rateLimitMetric.sevenDayFreeRatio,
          sevenDayEndEpoch: rateLimitMetric.sevenDayEndEpoch,
          liveSessionCount,
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

    const deterministicBest = eligible.reduce((bestEntry, currentEntry) =>
      this.preferred(currentEntry.metric, bestEntry.metric)
        ? currentEntry
        : bestEntry,
    );

    const selected = selectWeightedCandidate(
      eligible,
      (entry) => entry.candidate,
      deterministicBest,
      random,
    );

    return { selected: selected.candidate, metrics };
  };

  private preferred = (
    candidateMetric: LiveSessionOauthTokenCandidateMetrics,
    incumbentMetric: LiveSessionOauthTokenCandidateMetrics,
  ): boolean => {
    if (candidateMetric.liveSessionCount !== incumbentMetric.liveSessionCount) {
      return (
        candidateMetric.liveSessionCount < incumbentMetric.liveSessionCount
      );
    }
    return candidateMetric.sevenDayEndEpoch < incumbentMetric.sevenDayEndEpoch;
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
