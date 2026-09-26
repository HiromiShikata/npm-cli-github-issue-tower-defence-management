import type { ClaudeLiveSessionRepository } from '../../../domain/usecases/adapter-interfaces/ClaudeLiveSessionRepository';
import {
  type LiveSessionOauthTokenSelectionSettings,
  type LiveSessionOauthTokenSelectResult,
  LiveSessionOauthTokenSelectUseCase,
} from '../../../domain/usecases/LiveSessionOauthTokenSelectUseCase';
import {
  DEFAULT_SELECTION_WEIGHT,
  type OauthTokenCandidate,
} from '../../../domain/usecases/OauthTokenSelectUseCase';
import { FABLE_LIMIT_TYPE, readRateLimit } from '../../proxy/RateLimitCache';
import { loadTokenEntries } from '../../proxy/TokenListLoader';
import { ProcClaudeLiveSessionRepository } from '../../repositories/ProcClaudeLiveSessionRepository';
import {
  resolveCacheDirectory,
  resolveTokenListJsonPath,
} from './OauthTokenSelectHandler';

export type LiveSessionOauthTokenSelectHandlerInput = {
  tokenListJsonPath: string | null;
  cacheDirectory: string | null;
  nowEpochSeconds: number;
  selectionSettings: LiveSessionOauthTokenSelectionSettings;
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

    const candidates: OauthTokenCandidate[] = entries.map(
      ({ name, token, selectionWeight }) => {
        const snapshot = readRateLimit(token, cacheDirectory);
        const fableLimit = snapshot?.modelWeeklyLimits[FABLE_LIMIT_TYPE];
        const fableRejected =
          fableLimit !== undefined &&
          fableLimit.rejected &&
          input.nowEpochSeconds <= fableLimit.resetsAt;
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
          unifiedRejected: snapshot?.unifiedRejected ?? false,
          fableRejected,
          blockedUntilEpoch: snapshot?.blockedUntilEpoch ?? 0,
          selectionWeight: selectionWeight ?? DEFAULT_SELECTION_WEIGHT,
        };
      },
    );

    const liveSessions = this.liveSessionRepository.listLiveSessions();

    const result = this.useCase.run(
      candidates,
      liveSessions,
      input.nowEpochSeconds,
      input.selectionSettings,
    );

    return {
      selectedToken: result.selected?.token ?? null,
      selectedName: result.selected?.name ?? null,
      diagnostics: this.formatDiagnostics(
        result,
        input.nowEpochSeconds,
        input.selectionSettings,
      ),
    };
  };

  private formatDiagnostics = (
    result: LiveSessionOauthTokenSelectResult,
    nowEpochSeconds: number,
    settings: LiveSessionOauthTokenSelectionSettings,
  ): string[] => {
    const lines = result.metrics.map((metric) => {
      const secondsUntilSevenDayEnd = Math.round(
        metric.sevenDayEndEpoch - nowEpochSeconds,
      );
      const status = metric.eligible
        ? 'eligible'
        : `excluded (${metric.exclusionReason})`;
      return `${metric.name}: ${metric.liveSessionCount}/${metric.concurrentSessionLimit} live session(s), 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s, 7d budget drainable by 48h before reset: ${metric.sevenDayBudgetUndrainableBeforeSpendDeadline ? 'no' : 'yes'}, weight ${metric.selectionWeight} -> ${status}`;
    });

    if (result.selected === null) {
      lines.push(
        'No eligible token: every token is disabled for Claude Code subscription access or rejected by the API (unified status rejected or fable weekly limit exhausted), so no token can take a live session.',
      );
    } else {
      const selectedMetric = result.metrics.find(
        (m) => m.name === result.selected?.name,
      );
      const usedFallback =
        selectedMetric !== undefined && !selectedMetric.eligible;
      if (usedFallback) {
        lines.push(
          `Selected ${result.selected.name} via fallback (every token is excluded; ${result.selected.name} has the highest 5h free ratio among the tokens excluded only by an HTTP 401 auth failure).`,
        );
      } else {
        lines.push(
          `Selected ${result.selected.name} (eligible tokens are ordered with the tokens whose remaining 7d budget cannot be spent by 48h before the 7d reset at maxConcurrentSessionCount (${settings.maxConcurrentSessionCount}) sessions, one fully spent 5h window consuming 14% of the 7d window, moved to the front, then by 7d free ratio ascending; the first token still under its concurrent session limit is chosen, or the token least over its limit when none is under it; each limit is the lower of the 5h free-share throttle and the number of sessions the free 5h share sustains until the window resets at ${settings.fiveHourShareConsumedPerSessionHour} of the window per session-hour).`,
        );
      }
    }

    return lines;
  };
}
