import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface RateLimitSnapshot {
  fiveHourUtilization: number;
  fiveHourReset: number;
  sevenDayUtilization: number;
  sevenDayReset: number;
  blocked: boolean;
  rejected: boolean;
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

export const writeRateLimit = (
  token: string,
  headers: Record<string, string | string[] | undefined>,
): void => {
  const dir = cacheDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const pick = (key: string): string | undefined => {
    const value = headers[key];
    if (Array.isArray(value)) return value[0];
    return value;
  };
  const payload = {
    ts: Date.now() / 1000,
    headers: {
      'anthropic-ratelimit-unified-status': pick(
        'anthropic-ratelimit-unified-status',
      ),
      'anthropic-ratelimit-unified-5h-status': pick(
        'anthropic-ratelimit-unified-5h-status',
      ),
      'anthropic-ratelimit-unified-5h-reset': pick(
        'anthropic-ratelimit-unified-5h-reset',
      ),
      'anthropic-ratelimit-unified-5h-utilization': pick(
        'anthropic-ratelimit-unified-5h-utilization',
      ),
      'anthropic-ratelimit-unified-7d-status': pick(
        'anthropic-ratelimit-unified-7d-status',
      ),
      'anthropic-ratelimit-unified-7d-reset': pick(
        'anthropic-ratelimit-unified-7d-reset',
      ),
      'anthropic-ratelimit-unified-7d-utilization': pick(
        'anthropic-ratelimit-unified-7d-utilization',
      ),
    },
  };
  const filePath = path.join(dir, `${hashToken(token)}.json`);
  fs.writeFileSync(filePath, JSON.stringify(payload));
};

export const readRateLimit = (token: string): RateLimitSnapshot | null => {
  const filePath = cachePathForToken(token);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      value !== null && typeof value === 'object' && !Array.isArray(value);
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
    return {
      fiveHourUtilization: num('anthropic-ratelimit-unified-5h-utilization'),
      fiveHourReset: num('anthropic-ratelimit-unified-5h-reset'),
      sevenDayUtilization: num('anthropic-ratelimit-unified-7d-utilization'),
      sevenDayReset: num('anthropic-ratelimit-unified-7d-reset'),
      blocked:
        status === 'blocked' ||
        fiveHourStatus === 'blocked' ||
        sevenDayStatus === 'blocked',
      rejected:
        status === 'rejected' ||
        fiveHourStatus === 'rejected' ||
        sevenDayStatus === 'rejected',
    };
  } catch {
    return null;
  }
};
