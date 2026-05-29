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
  modelWeeklyLimits: Record<string, ModelWeeklyLimit>;
}

export const PROXY_PORT = 8787;

const HASH_ALGORITHM = 'sha256';

export const cacheDir = (): string => {
  const base = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
  return path.join(base, 'tdpm', 'ratelimit');
};

export const hashToken = (token: string): string =>
  crypto.createHash(HASH_ALGORITHM).update(token).digest('hex');

export const cachePathForToken = (token: string): string =>
  path.join(cacheDir(), `${hashToken(token)}.json`);

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

export const writeRateLimit = (
  token: string,
  headers: Record<string, string | string[] | undefined>,
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
  if (Object.keys(rateLimitHeaders).length === 0) {
    return;
  }
  const dir = cacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${hashToken(token)}.json`);
  const existing = readPayload(filePath);
  const payload = {
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

export const readRateLimit = (token: string): RateLimitSnapshot | null => {
  const filePath = cachePathForToken(token);
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
    const fiveHourStatus = headers['anthropic-ratelimit-unified-5h-status'];
    const sevenDayStatus = headers['anthropic-ratelimit-unified-7d-status'];
    const unifiedRejected = status === 'rejected';
    const fiveHourRejected = fiveHourStatus === 'rejected';
    const sevenDayRejected = sevenDayStatus === 'rejected';
    return {
      fiveHourUtilization: num('anthropic-ratelimit-unified-5h-utilization'),
      fiveHourReset: num('anthropic-ratelimit-unified-5h-reset'),
      sevenDayUtilization: num('anthropic-ratelimit-unified-7d-utilization'),
      sevenDayReset: num('anthropic-ratelimit-unified-7d-reset'),
      blocked:
        status === 'blocked' ||
        fiveHourStatus === 'blocked' ||
        sevenDayStatus === 'blocked',
      rejected: unifiedRejected || fiveHourRejected || sevenDayRejected,
      unifiedRejected,
      fiveHourRejected,
      sevenDayRejected,
      modelWeeklyLimits: readModelWeeklyLimits(parsed),
    };
  } catch {
    return null;
  }
};
