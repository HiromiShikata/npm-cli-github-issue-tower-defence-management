export const REST_RATE_LIMIT_ALWAYS_LOG_THRESHOLD = 500;

export const REST_RATE_LIMIT_DROP_THRESHOLD = 50;

export const REST_RATE_LIMIT_LOG_INTERVAL_MS = 300_000;

export const SENSITIVE_HEADER_NAMES: ReadonlySet<string> = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
]);

export type RestRateLimitState = {
  lastLoggedRemaining: number | null;
  lastLoggedAtMs: number;
};

export const createRestRateLimitState = (): RestRateLimitState => ({
  lastLoggedRemaining: null,
  lastLoggedAtMs: 0,
});

const moduleRestRateLimitState = createRestRateLimitState();

const parseNonNegativeIntegerHeader = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractUrlPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
};

export const sanitizeHeaders = (headers: Headers): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  headers.forEach((value, name) => {
    sanitized[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase())
      ? '[REDACTED]'
      : value;
  });
  return sanitized;
};

export const sanitizeErrorForLogging = (error: unknown): unknown => {
  if (!(error instanceof Error)) {
    return error;
  }
  const sanitizedParts: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  let hasSanitizedHttpContent = false;
  if ('request' in error) {
    const req: unknown = error.request;
    if (req instanceof Request) {
      sanitizedParts.request = {
        method: req.method,
        url: extractUrlPath(req.url),
        headers: sanitizeHeaders(req.headers),
      };
      hasSanitizedHttpContent = true;
    }
  }
  if ('response' in error) {
    const resp: unknown = error.response;
    if (resp instanceof Response) {
      sanitizedParts.response = {
        status: resp.status,
        statusText: resp.statusText,
        headers: sanitizeHeaders(resp.headers),
      };
      hasSanitizedHttpContent = true;
    }
  }
  return hasSanitizedHttpContent ? sanitizedParts : error;
};

export type RestRateLimitHeaders = {
  remaining: number | null;
  limit: number | null;
  resource: string | null;
  resetEpochSeconds: number | null;
};

export const extractRestRateLimitHeaders = (
  headers: Headers,
): RestRateLimitHeaders => ({
  remaining: parseNonNegativeIntegerHeader(
    headers.get('x-ratelimit-remaining'),
  ),
  limit: parseNonNegativeIntegerHeader(headers.get('x-ratelimit-limit')),
  resource: headers.get('x-ratelimit-resource'),
  resetEpochSeconds: parseNonNegativeIntegerHeader(
    headers.get('x-ratelimit-reset'),
  ),
});

export const shouldLogRestRateLimit = (
  remaining: number,
  state: RestRateLimitState,
  nowMs: number,
): boolean => {
  if (remaining < REST_RATE_LIMIT_ALWAYS_LOG_THRESHOLD) {
    return true;
  }
  if (state.lastLoggedRemaining === null) {
    return true;
  }
  if (nowMs - state.lastLoggedAtMs >= REST_RATE_LIMIT_LOG_INTERVAL_MS) {
    return true;
  }
  if (state.lastLoggedRemaining - remaining >= REST_RATE_LIMIT_DROP_THRESHOLD) {
    return true;
  }
  return false;
};

export const logGithubRestRateLimit = (params: {
  url: string;
  headers: Headers;
  state?: RestRateLimitState;
  now?: () => Date;
}): void => {
  const state = params.state ?? moduleRestRateLimitState;
  const now = params.now ?? (() => new Date());
  const { remaining, limit, resource, resetEpochSeconds } =
    extractRestRateLimitHeaders(params.headers);
  if (remaining === null) {
    return;
  }
  const nowDate = now();
  const nowMs = nowDate.getTime();
  if (!shouldLogRestRateLimit(remaining, state, nowMs)) {
    return;
  }
  state.lastLoggedRemaining = remaining;
  state.lastLoggedAtMs = nowMs;
  const path = extractUrlPath(params.url);
  const resetIso =
    resetEpochSeconds !== null
      ? new Date(resetEpochSeconds * 1000).toISOString()
      : 'unknown';
  console.log(
    `${nowDate.toISOString()} githubRestClient: path=${path} remaining=${remaining} limit=${limit ?? 'unknown'} resource=${resource ?? 'unknown'} reset=${resetIso}`,
  );
};
