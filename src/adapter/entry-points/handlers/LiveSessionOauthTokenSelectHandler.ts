import { ClaudeLiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import {
  LiveSessionOauthTokenSelectResult,
  LiveSessionOauthTokenSelectUseCase,
} from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import {
  FIVE_HOUR_MIN_FREE_RATIO,
  OauthTokenCandidate,
  SEVEN_DAY_MIN_FREE_RATIO,
} from '../../../domain/usecases/OauthTokenSelectUseCase';
import { ProcClaudeLiveSessionRepository } from '../../repositories/ProcClaudeLiveSessionRepository';
import { readRateLimit } from '../../proxy/RateLimitCache';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import {
  resolveCacheDirectory,
  resolveTokenListJsonPath,
} from './OauthTokenSelectHandler';

export type LiveSessionOauthTokenSelectHandlerInput = {
  tokenListJsonPath: string | null;
  cacheDirectory: string | null;
  nowEpochSeconds: number;
};

export type LiveSessionOauthTokenSelectHandlerOutput = {
  selectedToken: string | null;
  selectedName: string | null;
  diagnostics: string[];
};

export class LiveSessionOauthTokenSelectHandler {
  constructor(
    private readonly useCase: LiveSessionOauthTokenSelectUseCase = new LiveSessionOauthTokenSelectUseCase(),
    private readonly liveSessionRepository: ClaudeLiveSessionRepository = new ProcClaudeLiveSessionRepository(),
  ) {}

  handle = (
    input: LiveSessionOauthTokenSelectHandlerInput,
  ): LiveSessionOauthTokenSelectHandlerOutput => {
    const tokenListJsonPath = resolveTokenListJsonPath(input.tokenListJsonPath);
    if (tokenListJsonPath === null) {
      return {
        selectedToken: null,
        selectedName: null,
        diagnostics: [
          'No token list path provided. Pass --tokenListJsonPath or set CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH.',
        ],
      };
    }

    const entries = loadTokenEntries(tokenListJsonPath);
    if (entries === null) {
      return {
        selectedToken: null,
        selectedName: null,
        diagnostics: [
          `No usable token entries loaded from ${tokenListJsonPath}.`,
        ],
      };
    }

    const cacheDirectory = resolveCacheDirectory(input.cacheDirectory);

    const candidates: OauthTokenCandidate[] = entries.map(({ name, token }) => {
      const snapshot = readRateLimit(token, cacheDirectory);
      return {
        name,
        token,
        snapshot:
          snapshot === null
            ? null
            : {
                fiveHourUtilization: snapshot.fiveHourUtilization,
                fiveHourReset: snapshot.fiveHourReset,
                sevenDayUtilization: snapshot.sevenDayUtilization,
                sevenDayReset: snapshot.sevenDayReset,
              },
        subscriptionDisabled: snapshot?.subscriptionDisabled ?? false,
      };
    });

    const liveSessions = this.liveSessionRepository.listLiveSessions();

    const result = this.useCase.run(
      candidates,
      liveSessions,
      input.nowEpochSeconds,
    );

    return {
      selectedToken: result.selected?.token ?? null,
      selectedName: result.selected?.name ?? null,
      diagnostics: this.formatDiagnostics(result, input.nowEpochSeconds),
    };
  };

  private formatDiagnostics = (
    result: LiveSessionOauthTokenSelectResult,
    nowEpochSeconds: number,
  ): string[] => {
    const lines = result.metrics.map((metric) => {
      const secondsUntilSevenDayEnd = Math.round(
        metric.sevenDayEndEpoch - nowEpochSeconds,
      );
      const status = metric.eligible
        ? 'eligible'
        : `excluded (${metric.exclusionReason})`;
      return `${metric.name}: ${metric.liveSessionCount} live session(s), 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s -> ${status}`;
    });

    if (result.selected === null) {
      lines.push(
        `No eligible token: every token is below the 5h >= ${Math.round(FIVE_HOUR_MIN_FREE_RATIO * 100)}% free and 7d >= ${Math.round(SEVEN_DAY_MIN_FREE_RATIO * 100)}% free thresholds required to start a live session.`,
      );
    } else {
      lines.push(
        `Selected ${result.selected.name} (fewest live sessions, then soonest 7d reset among eligible tokens).`,
      );
    }

    return lines;
  };
}
