import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  STALE_STATE_MAX_AGE_MS,
  checkSecondaryRateLimitBreaker,
  readSecondaryRateLimitState,
  writeSecondaryRateLimitState,
} from './githubSecondaryRateLimitBreaker';
import {
  fetchWithGitHubRateLimitRetry,
  SECONDARY_RATE_LIMIT_FLOOR_MS,
} from './githubRateLimitRetry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTmpDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'tdpm-breaker-test-'));

const stateFile = (dir: string): string =>
  path.join(dir, 'gh-secondary-rate-limit.json');

// ---------------------------------------------------------------------------
// readSecondaryRateLimitState
// ---------------------------------------------------------------------------

describe('readSecondaryRateLimitState', () => {
  it('returns null when the file does not exist', () => {
    const dir = makeTmpDir();
    expect(readSecondaryRateLimitState(stateFile(dir))).toBeNull();
    fs.rmSync(dir, { recursive: true });
  });

  it('returns null when the file contains invalid JSON (malformed)', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    fs.writeFileSync(fp, '{ not valid json }');
    expect(readSecondaryRateLimitState(fp)).toBeNull();
    fs.rmSync(dir, { recursive: true });
  });

  it('returns null when the file contains valid JSON but the wrong shape', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    fs.writeFileSync(fp, JSON.stringify({ foo: 'bar' }));
    expect(readSecondaryRateLimitState(fp)).toBeNull();
    fs.rmSync(dir, { recursive: true });
  });

  it('returns the state when the file is valid', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const state = { resetTimeMs: 9_000_000, detectedAtMs: 1_000_000 };
    fs.writeFileSync(fp, JSON.stringify(state));
    expect(readSecondaryRateLimitState(fp)).toEqual(state);
    fs.rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// writeSecondaryRateLimitState
// ---------------------------------------------------------------------------

describe('writeSecondaryRateLimitState', () => {
  it('writes a readable state file and creates the directory if needed', () => {
    const dir = makeTmpDir();
    const fp = path.join(dir, 'subdir', 'state.json');
    writeSecondaryRateLimitState(9_000_000, 1_000_000, fp);
    expect(readSecondaryRateLimitState(fp)).toEqual({
      resetTimeMs: 9_000_000,
      detectedAtMs: 1_000_000,
    });
    fs.rmSync(dir, { recursive: true });
  });

  it('overwrites an existing state file atomically', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    writeSecondaryRateLimitState(1_000, 500, fp);
    writeSecondaryRateLimitState(9_000_000, 8_000_000, fp);
    expect(readSecondaryRateLimitState(fp)).toEqual({
      resetTimeMs: 9_000_000,
      detectedAtMs: 8_000_000,
    });
    fs.rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// checkSecondaryRateLimitBreaker
// ---------------------------------------------------------------------------

describe('checkSecondaryRateLimitBreaker', () => {
  it('returns not-blocked when the state file is missing', () => {
    const dir = makeTmpDir();
    const result = checkSecondaryRateLimitBreaker(Date.now(), stateFile(dir));
    expect(result.isBlocked).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns not-blocked when the file is malformed (fallback, not crash)', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    fs.writeFileSync(fp, 'not-json');
    const result = checkSecondaryRateLimitBreaker(Date.now(), fp);
    expect(result.isBlocked).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns not-blocked when the file has the wrong shape (malformed state)', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    fs.writeFileSync(fp, JSON.stringify({ unexpected: true }));
    const result = checkSecondaryRateLimitBreaker(Date.now(), fp);
    expect(result.isBlocked).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns not-blocked when the reset time has already passed', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    // Reset 5 minutes in the past, detected 10 minutes ago (fresh enough)
    writeSecondaryRateLimitState(nowMs - 5 * 60_000, nowMs - 10 * 60_000, fp);
    const result = checkSecondaryRateLimitBreaker(nowMs, fp);
    expect(result.isBlocked).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns not-blocked when the state is stale (detectedAtMs older than 1 hour)', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    // Reset still in the future, but detection was > 1 hour ago
    const detectedAtMs = nowMs - STALE_STATE_MAX_AGE_MS - 1;
    writeSecondaryRateLimitState(nowMs + 30 * 60_000, detectedAtMs, fp);
    const result = checkSecondaryRateLimitBreaker(nowMs, fp);
    expect(result.isBlocked).toBe(false);
    fs.rmSync(dir, { recursive: true });
  });

  it('returns blocked with the reset time when the block is active', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    const resetTimeMs = nowMs + 60_000;
    writeSecondaryRateLimitState(resetTimeMs, nowMs, fp);
    const result = checkSecondaryRateLimitBreaker(nowMs, fp);
    expect(result.isBlocked).toBe(true);
    expect(result.resetTimeMs).toBe(resetTimeMs);
    fs.rmSync(dir, { recursive: true });
  });

  it('a block recorded by one writer is honoured by a second reader', () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    const resetTimeMs = nowMs + 90_000;

    // Writer process records the block
    writeSecondaryRateLimitState(resetTimeMs, nowMs, fp);

    // Independent reader process checks the same file
    const result = checkSecondaryRateLimitBreaker(nowMs, fp);
    expect(result.isBlocked).toBe(true);
    expect(result.resetTimeMs).toBe(resetTimeMs);
    fs.rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// fetchWithGitHubRateLimitRetry — circuit breaker integration
// ---------------------------------------------------------------------------

describe('fetchWithGitHubRateLimitRetry — circuit breaker', () => {
  it('does not issue the request when a live block is recorded in the state file', async () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    const resetTimeMs = nowMs + 60_000;
    writeSecondaryRateLimitState(resetTimeMs, nowMs, fp);

    const sleep = jest.fn().mockResolvedValue(undefined);
    const request = jest.fn<Promise<Response>, []>();

    const response = await fetchWithGitHubRateLimitRetry(
      request,
      sleep,
      Date.now,
      false,
      true, // isContentCreating
      fp,
    );

    // The request must not have been issued at all
    expect(request).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
    const rawBody = await response.text();
    expect(rawBody).toContain(new Date(resetTimeMs).toISOString());
    fs.rmSync(dir, { recursive: true });
  });

  it('issues the request normally when no state file exists', async () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const sleep = jest.fn().mockResolvedValue(undefined);
    const request = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const response = await fetchWithGitHubRateLimitRetry(
      request,
      sleep,
      Date.now,
      false,
      true, // isContentCreating
      fp,
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    fs.rmSync(dir, { recursive: true });
  });

  it('issues the request normally when the block has expired', async () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    // Reset 1 second in the past
    writeSecondaryRateLimitState(nowMs - 1000, nowMs - 65_000, fp);

    const sleep = jest.fn().mockResolvedValue(undefined);
    const request = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValue(new Response('{}', { status: 200 }));

    const response = await fetchWithGitHubRateLimitRetry(
      request,
      sleep,
      Date.now,
      false,
      true, // isContentCreating
      fp,
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    fs.rmSync(dir, { recursive: true });
  });

  it('writes the state file when a secondary rate limit is detected', async () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();

    const sleep = jest.fn().mockResolvedValue(undefined);
    const request = jest.fn<Promise<Response>, []>().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'You have exceeded a secondary rate limit',
        }),
        { status: 403 },
      ),
    );

    await fetchWithGitHubRateLimitRetry(
      request,
      sleep,
      Date.now,
      false,
      true, // isContentCreating
      fp,
    );

    const state = readSecondaryRateLimitState(fp);
    expect(state).not.toBeNull();
    if (state !== null) {
      expect(state.detectedAtMs).toBeGreaterThanOrEqual(nowMs);
      expect(state.resetTimeMs).toBeGreaterThanOrEqual(
        nowMs + SECONDARY_RATE_LIMIT_FLOOR_MS,
      );
    }
    fs.rmSync(dir, { recursive: true });
  });

  it('does not check the circuit breaker for read (non-content-creating) requests', async () => {
    const dir = makeTmpDir();
    const fp = stateFile(dir);
    const nowMs = Date.now();
    // Record a live block
    writeSecondaryRateLimitState(nowMs + 60_000, nowMs, fp);

    const sleep = jest.fn().mockResolvedValue(undefined);
    const request = jest
      .fn<Promise<Response>, []>()
      .mockResolvedValue(new Response('{}', { status: 200 }));

    // isContentCreating defaults to false — circuit breaker is not consulted
    const response = await fetchWithGitHubRateLimitRetry(
      request,
      sleep,
      Date.now,
      false,
      false, // NOT a content-creating request
      fp,
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    fs.rmSync(dir, { recursive: true });
  });
});
