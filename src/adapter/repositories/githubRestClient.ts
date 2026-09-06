import { extractCallSite } from './stackFrameUtils';

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

export const sanitizeRestPath = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    const questionMark = url.indexOf('?');
    return questionMark === -1 ? url : url.slice(0, questionMark);
  }
};

const REST_INFRASTRUCTURE_MODULES = new Set([
  'githubRestClient',
  'githubRateLimitRetry',
]);

export const extractRestCallSite = (
  stack: string | undefined,
  modulePath: string = __filename,
): string =>
  extractCallSite(
    stack,
    (name) => REST_INFRASTRUCTURE_MODULES.has(name),
    modulePath,
  );

export const captureRestCallSite = (): string =>
  extractRestCallSite(new Error().stack);

export const logGithubRestRateLimit = (params: {
  headers: Headers;
  method: string;
  path: string;
  caller: string;
  now?: () => Date;
}): void => {
  const remaining = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-remaining'),
  );
  if (remaining === null) {
    return;
  }
  const now = params.now ?? (() => new Date());
  const used = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-used'),
  );
  const limit = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-limit'),
  );
  const resource = params.headers.get('x-ratelimit-resource');
  const resetEpochSeconds = parseNonNegativeIntegerHeader(
    params.headers.get('x-ratelimit-reset'),
  );
  const resetIso =
    resetEpochSeconds !== null
      ? new Date(resetEpochSeconds * 1000).toISOString()
      : null;
  console.log(
    `${now().toISOString()} githubRestClient: method=${params.method} path=${params.path} resource=${resource} used=${used} remaining=${remaining} limit=${limit} reset=${resetIso} caller=${params.caller}`,
  );
};
