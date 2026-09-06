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

export const logGithubRestRateLimit = (params: {
  headers: Headers;
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
    `${now().toISOString()} githubRestClient: resource=${resource} used=${used} remaining=${remaining} limit=${limit} reset=${resetIso}`,
  );
};
