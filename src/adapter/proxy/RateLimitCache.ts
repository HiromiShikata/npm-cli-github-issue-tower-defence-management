import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface ModelWeeklyLimit {
  rejected: boolean;
  resetsAt: number;
}

export interface RateLimitSnapshot {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
  blocked: boolean;
  rejected: boolean;
  unifiedRejected: boolean;
  fiveHourRejected: boolean;
  sevenDayRejected: boolean;
  unifiedStatus: string | null;
  overageDisabledReason: string | null;
  modelWeeklyLimits: Record<string, ModelWeeklyLimit>;
  lastUpdatedEpoch: number;
  blockedUntilEpoch: number;
  subscriptionDisabled: boolean;
}

export const PROXY_PORT = 8787;

export const FABLE_LIMIT_TYPE = 'seven_day_fable';

const HASH_ALGORITHM = 'sha256';

export const HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS = 90;

export const HEADERLESS_429_MAX_COOLDOWN_SECONDS = 600;

export const PERMISSION_DISABLED_COOLDOWN_SECONDS = 3600;

const FIVE_HOUR_STATUS_HEADER = 'anthropic-ratelimit-unified-5h-status';

const SEVEN_DAY_STATUS_HEADER = 'anthropic-ratelimit-unified-7d-status';

const SEVEN_DAY_RESET_HEADER = 'anthropic-ratelimit-unified-7d-reset';

export const cacheDir = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'ratelimit');
};

export const hashToken = (token: string): string =>
  crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');

export const cachePathForToken = (
  token: string,
  baseDir: string = cacheDir(),
): string => path.join(baseDir, `${hashToken(token)}.json`);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const readPayload = (filePath: string): Record<string, unknown> => {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const readModelWeeklyLimits = (
  payload: Record<string, unknown>,
): Record<string, ModelWeeklyLimit> => {
  const stored = payload.modelWeeklyLimits;
  const result: Record<string, ModelWeeklyLimit> = {};
  if (!isRecord(stored)) return result;
  for (const [limitType, value] of Object.entries(stored)) {
    if (!isRecord(value)) continue;
    const rejected = value.rejected;
    const resetsAt = value.resetsAt;
    if (typeof rejected === 'boolean' && typeof resetsAt === 'number') {
      result[limitType] = { rejected, resetsAt };
    }
  }
  return result;
};

const readSubscriptionDisabledEpoch = (
  payload: Record<string, unknown>,
): { subscriptionDisabledEpoch: number } | Record<string, never> => {
  const stored = payload.subscriptionDisabledEpoch;
  if (typeof stored === 'number') {
    return { subscriptionDisabledEpoch: stored };
  }
  return {};
};

const cooldownEndFromRetryAfter = (
  retryAfterSeconds: number | null,
  nowEpochSeconds: number,
): number => {
  const cooldownSeconds =
    retryAfterSeconds !== null && retryAfterSeconds > 0
      ? Math.min(retryAfterSeconds, HEADERLESS_429_MAX_COOLDOWN_SECONDS)
      : HEADERLESS_429_DEFAULT_COOLDOWN_SECONDS;
  return nowEpochSeconds + cooldownSeconds;
};

export const writeRateLimit = (
  token: string,
  headers: Record<string, string | string[] | undefined>,
  statusCode: number | null = null,
): void => {
  const pick = (key: string): string | undefined => {
    const value = headers[key];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  const rateLimitHeaders: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    if (key.startsWith('anthropic-ratelimit-')) {
      const value = pick(key);
      if (value !== undefined) {
        rateLimitHeaders[key] = value;
      }
    }
  }
  const dir = cacheDir();
  const filePath = path.join(dir, `${hashToken(token)}.json`);
  if (Object.keys(rateLimitHeaders).length === 0) {
    if (statusCode !== 429) {
      return;
    }
    const existing = readPayload(filePath);
    const retryAfterRaw = pick('retry-after');
    const retryAfterSeconds =
      retryAfterRaw !== undefined && Number.isFinite(Number(retryAfterRaw))
        ? Number(retryAfterRaw)
        : null;
    const blockedUntilEpoch = cooldownEndFromRetryAfter(
      retryAfterSeconds,
      Date.now() / 1000,
    );
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload = {
      ...existing,
      blockedUntilEpoch,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload));
    return;
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const existing = readPayload(filePath);
  const payload = {
    ...readSubscriptionDisabledEpoch(existing),
    ts: Date.now() / 1000,
    headers: rateLimitHeaders,
    modelWeeklyLimits: readModelWeeklyLimits(existing),
  };
  fs.writeFileSync(filePath, JSON.stringify(payload));
};

export const writeModelRateLimit = (
  token: string,
  limits: Record<string, ModelWeeklyLimit>,
): void => {
  const limitTypes = Object.keys(limits);
  if (limitTypes.length === 0) return;
  const dir = cacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${hashToken(token)}.json`);
  const existing = readPayload(filePath);
  const merged = {
    ...readModelWeeklyLimits(existing),
    ...limits,
  };
  const payload = {
    ...existing,
    modelWeeklyLimits: merged,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload));
};

export const isFableModel = (modelName: string | null): boolean =>
  (modelName ?? '').toLowerCase().includes('fable');

export interface SevenDayRejectionSignal {
  sevenDayRejected: boolean;
  sevenDayReset: number | null;
}

const pickHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const value = headers[key];
  return Array.isArray(value) ? value[0] : value;
};

export const parseSevenDayRejection = (
  headers: Record<string, string | string[] | undefined>,
): SevenDayRejectionSignal => {
  const status = pickHeaderValue(headers, SEVEN_DAY_STATUS_HEADER);
  const resetRaw = pickHeaderValue(headers, SEVEN_DAY_RESET_HEADER);
  const sevenDayReset =
    resetRaw !== undefined && Number.isFinite(Number(resetRaw))
      ? Number(resetRaw)
      : null;
  return {
    sevenDayRejected: status === 'rejected',
    sevenDayReset,
  };
};

export const writeFableRejection = (
  token: string,
  retryAfterSeconds: number | null,
  sevenDayReset: number | null = null,
): void => {
  const resetsAt =
    sevenDayReset !== null && sevenDayReset > 0
      ? sevenDayReset
      : cooldownEndFromRetryAfter(retryAfterSeconds, Date.now() / 1000);
  writeModelRateLimit(token, {
    [FABLE_LIMIT_TYPE]: { rejected: true, resetsAt },
  });
};

export const writeSubscriptionDisabled = (
  token: string,
  baseDir: string = cacheDir(),
): void => {
  const dir = baseDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${hashToken(token)}.json`);
  const existing = readPayload(filePath);
  const payload = {
    ...existing,
    subscriptionDisabledEpoch: Date.now() / 1000,
  };
  fs.writeFileSync(filePath, JSON.stringify(payload));
};

export const parseModelRateLimitsFromBody = (
  body: string,
): Record<string, ModelWeeklyLimit> => {
  const result: Record<string, ModelWeeklyLimit> = {};
  const matches = body.match(
    /\{[^{}]*"rateLimitType"[^{}]*\}|\{[^{}]*"resetsAt"[^{}]*"rateLimitType"[^{}]*\}/g,
  );
  if (matches === null) return result;
  for (const candidate of matches) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const rateLimitType = parsed.rateLimitType;
    const status = parsed.status;
    const resetsAt = parsed.resetsAt;
    if (typeof rateLimitType !== 'string') continue;
    if (typeof status !== 'string') continue;
    if (typeof resetsAt !== 'number') continue;
    result[rateLimitType] = {
      rejected: status === 'rejected',
      resetsAt,
    };
  }
  return result;
};

const HEADER_CLAIM_TO_LIMIT_TYPE: Record<string, string> = {
  '7d_sonnet': 'seven_day_sonnet',
  '7d_opus': 'seven_day_opus',
};

export const parseModelRateLimitsFromHeaders = (
  headers: Record<string, string>,
): Record<string, ModelWeeklyLimit> => {
  const result: Record<string, ModelWeeklyLimit> = {};
  for (const [headerClaim, limitType] of Object.entries(
    HEADER_CLAIM_TO_LIMIT_TYPE,
  )) {
    const status = headers[`anthropic-ratelimit-unified-${headerClaim}-status`];
    const resetRaw =
      headers[`anthropic-ratelimit-unified-${headerClaim}-reset`];
    if (status === undefined) continue;
    const resetsAt =
      resetRaw !== undefined && Number.isFinite(Number(resetRaw))
        ? Number(resetRaw)
        : 0;
    result[limitType] = {
      rejected: status === 'rejected',
      resetsAt,
    };
  }
  return result;
};

export const readRateLimit = (
  token: string,
  baseDir: string = cacheDir(),
): RateLimitSnapshot | null => {
  const filePath = cachePathForToken(token, baseDir);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    const headersUnknown = parsed.headers;
    const headers: Record<string, string> = {};
    if (isRecord(headersUnknown)) {
      for (const [key, value] of Object.entries(headersUnknown)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
    }
    const num = (key: string): number => {
      const value = headers[key];
      if (typeof value !== 'string') return 0;
      const parsedValue = Number(value);
      return Number.isFinite(parsedValue) ? parsedValue : 0;
    };
    const status = headers['anthropic-ratelimit-unified-status'];
    const fiveHourStatus = headers[FIVE_HOUR_STATUS_HEADER];
    const sevenDayStatus = headers[SEVEN_DAY_STATUS_HEADER];
    const overageDisabledReason =
      headers['anthropic-ratelimit-unified-overage-disabled-reason'];
    const unifiedRejected = status === 'rejected';
    const fiveHourRejected = fiveHourStatus === 'rejected';
    const sevenDayRejected = sevenDayStatus === 'rejected';
    const storedTs = parsed.ts;
    const lastUpdatedEpoch = typeof storedTs === 'number' ? storedTs : 0;
    const storedBlockedUntil = parsed.blockedUntilEpoch;
    const blockedUntilEpoch =
      typeof storedBlockedUntil === 'number' ? storedBlockedUntil : 0;
    const storedSubscriptionDisabledEpoch = parsed.subscriptionDisabledEpoch;
    const subscriptionDisabledEpoch =
      typeof storedSubscriptionDisabledEpoch === 'number'
        ? storedSubscriptionDisabledEpoch
        : 0;
    const nowEpochSeconds = Date.now() / 1000;
    const subscriptionDisabled =
      subscriptionDisabledEpoch > 0 &&
      nowEpochSeconds - subscriptionDisabledEpoch <
        PERMISSION_DISABLED_COOLDOWN_SECONDS;
    return {
      fiveHourUtilization: num('anthropic-ratelimit-unified-5h-utilization'),
      fiveHourReset: num('anthropic-ratelimit-unified-5h-reset'),
      sevenDayUtilization: num('anthropic-ratelimit-unified-7d-utilization'),
      sevenDayReset: num(SEVEN_DAY_RESET_HEADER),
      blocked:
        status === 'blocked' ||
        fiveHourStatus === 'blocked' ||
        sevenDayStatus === 'blocked',
      rejected: unifiedRejected || fiveHourRejected || sevenDayRejected,
      unifiedRejected,
      fiveHourRejected,
      sevenDayRejected,
      unifiedStatus: status ?? null,
      overageDisabledReason: overageDisabledReason ?? null,
      modelWeeklyLimits: {
        ...parseModelRateLimitsFromHeaders(headers),
        ...readModelWeeklyLimits(parsed),
      },
      lastUpdatedEpoch,
      blockedUntilEpoch,
      subscriptionDisabled,
    };
  } catch {
    return null;
  }
};
