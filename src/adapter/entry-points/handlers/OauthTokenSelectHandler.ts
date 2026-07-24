import {
  OauthTokenCandidate,
  OauthTokenSelectResult,
  OauthTokenSelectUseCase,
} from '../../../domain/usecases/OauthTokenSelectUseCase';
import {
  FABLE_LIMIT_TYPE,
  cacheDir,
  readRateLimit,
} from '../../proxy/RateLimitCache';
import { loadTokenEntries } from '../../proxy/TokenListLoader';

export type OauthTokenSelectHandlerInput = {
  tokenListJsonPath: string | null;
  cacheDirectory: string | null;
  nowEpochSeconds: number;
};

export type OauthTokenSelectHandlerOutput = {
  selectedToken: string | null;
  selectedName: string | null;
  diagnostics: string[];
};

const DEFAULT_TOKEN_LIST_PATH_ENV = 'CLAUDE_CODE_OAUTH_TOKEN_LIST_JSON_PATH';
const DEFAULT_CACHE_DIRECTORY_ENV = 'TDPM_RATELIMIT_CACHE_DIR';

export const resolveTokenListJsonPath = (
  explicitPath: string | null,
): string | null => {
  if (explicitPath !== null && explicitPath.length > 0) {
    return explicitPath;
  }
  const fromEnv = process.env[DEFAULT_TOKEN_LIST_PATH_ENV];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return null;
};

export const resolveCacheDirectory = (
  explicitDirectory: string | null,
): string => {
  if (explicitDirectory !== null && explicitDirectory.length > 0) {
    return explicitDirectory;
  }
  const fromEnv = process.env[DEFAULT_CACHE_DIRECTORY_ENV];
  if (fromEnv !== undefined && fromEnv.length > 0) {
    return fromEnv;
  }
  return cacheDir();
};

export class OauthTokenSelectHandler {
  constructor(
    private readonly useCase: OauthTokenSelectUseCase = new OauthTokenSelectUseCase(),
  ) {}

  handle = (
    input: OauthTokenSelectHandlerInput,
  ): OauthTokenSelectHandlerOutput => {
    const tokenListJsonPath = resolveTokenListJsonPath(input.tokenListJsonPath);
    if (tokenListJsonPath === null) {
      return {
        selectedToken: null,
        selectedName: null,
        diagnostics: [
          `No token list path provided. Pass --tokenListJsonPath or set ${DEFAULT_TOKEN_LIST_PATH_ENV}.`,
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
      };
    });

    const result = this.useCase.run(candidates, input.nowEpochSeconds);

    return {
      selectedToken: result.selected?.token ?? null,
      selectedName: result.selected?.name ?? null,
      diagnostics: this.formatDiagnostics(result, input.nowEpochSeconds),
    };
  };

  private formatDiagnostics = (
    result: OauthTokenSelectResult,
    nowEpochSeconds: number,
  ): string[] => {
    const lines = result.metrics.map((metric) => {
      const secondsUntilSevenDayEnd = Math.round(
        metric.sevenDayEndEpoch - nowEpochSeconds,
      );
      const status = metric.eligible
        ? 'eligible'
        : `excluded (${metric.exclusionReason})`;
      return `${metric.name}: 5h ${Math.round(metric.fiveHourFreeRatio * 100)}% free, 7d ${Math.round(metric.sevenDayFreeRatio * 100)}% free, 7d-end in ${secondsUntilSevenDayEnd}s -> ${status}`;
    });

    if (result.selected === null) {
      lines.push('No eligible token passed the rate-limit filter.');
    } else {
      lines.push(
        `Selected ${result.selected.name} (soonest 7d reset among eligible tokens).`,
      );
    }

    return lines;
  };
}
