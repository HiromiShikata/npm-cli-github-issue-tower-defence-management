/**
 * Acceptance tests for new concurrent session limit behavior.
 *
 * These tests MUST FAIL against the current implementation.
 * They define the intended behavior after the fix for issue #2583.
 *
 * SC-1: concurrent limit is derived from sustainable tokens/hour rate
 * SC-2: low free ratio limits to 1
 * SC-3: unknown reset time defaults to 5 hours
 * SC-5: overflow selection uses lowest (count+1)/limit ratio
 * SC-6a: fiveHourShareConsumedPerSessionHour=0.1 halves the limit vs the default
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
  LiveSessionOauthTokenSelectUseCase,
  type LiveSessionOauthTokenSelectionSettings,
} from './LiveSessionOauthTokenSelectUseCase';
import type { OauthTokenCandidate, OauthTokenWindowSnapshot } from './OauthTokenSelectUseCase';
import { loadLiveSessionOauthTokenSelectionSettings } from '../../adapter/entry-points/cli/fleetConfig';

const NOW = 1_000_000;
const HOUR = 3600;
const DAY = 86400;

const SETTINGS = DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;

const snapshot = (
  overrides: Partial<OauthTokenWindowSnapshot>,
): OauthTokenWindowSnapshot => ({
  fiveHourUtilization: 0,
  fiveHourReset: NOW + 5 * HOUR,
  sevenDayUtilization: 0,
  sevenDayReset: NOW + 7 * DAY,
  ...overrides,
});

const candidate = (
  name: string,
  snapshotValue: OauthTokenWindowSnapshot | null,
  selectionWeight?: number,
): OauthTokenCandidate => ({
  name,
  token: `fake-token-${name}`,
  snapshot: snapshotValue,
  subscriptionDisabled: false,
  unifiedRejected: false,
  fableRejected: false,
  blockedUntilEpoch: 0,
  ...(selectionWeight !== undefined ? { selectionWeight } : {}),
});

const sessionsFor = (name: string, count: number): ClaudeLiveSession[] =>
  Array.from({ length: count }, (_unused, index) => ({
    token: `fake-token-${name}`,
    sessionKey: `${name}-session-${index}`,
  }));

const useCase = new LiveSessionOauthTokenSelectUseCase();

describe('SC-1: concurrent limit uses time-to-reset', () => {
  /**
   * New formula: floor(min(fiveHourFreeRatio / hoursUntilReset, 1/5) / fiveHourShareConsumedPerSessionHour)
   * Input: fiveHourFreeRatio=0.68, hoursUntilFiveHourReset=4.6, fiveHourShareConsumedPerSessionHour=0.05 (default)
   * Math: floor(min(0.68/4.6, 0.2) / 0.05) = floor(min(0.14782, 0.2) / 0.05) = floor(2.957) = 2
   * final = min(10, 2) = 2
   * Currently: liveSessionConcurrentLimitOf(0.68, selectionWeight=1, SETTINGS) = 10 → FAILS
   */
  it('gives a limit of 2 for fiveHourFreeRatio=0.68 with 4.6 hours until reset', () => {
    const result = useCase.run(
      [
        candidate('tokenA', snapshot({
          fiveHourUtilization: 0.32,          // fiveHourFreeRatio = 0.68
          fiveHourReset: NOW + 4.6 * HOUR,
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 7 * DAY,
        })),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const metric = result.metrics.find((m) => m.name === 'tokenA');
    expect(metric?.concurrentSessionLimit).toBe(2);
  });
});

describe('SC-2: low free ratio limits to 1', () => {
  /**
   * Input: fiveHourFreeRatio=0.27, hoursUntilFiveHourReset=4.3, fiveHourShareConsumedPerSessionHour=0.05
   * Math: floor(min(0.27/4.3, 0.2) / 0.05) = floor(0.06279/0.05) = floor(1.256) = 1
   * Currently: liveSessionConcurrentLimitOf(0.27, 1, SETTINGS) = floor(10*0.54) = 5 → FAILS
   */
  it('gives a limit of 1 for fiveHourFreeRatio=0.27 with 4.3 hours until reset', () => {
    const result = useCase.run(
      [
        candidate('tokenB', snapshot({
          fiveHourUtilization: 0.73,          // fiveHourFreeRatio = 0.27
          fiveHourReset: NOW + 4.3 * HOUR,
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 7 * DAY,
        })),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const metric = result.metrics.find((m) => m.name === 'tokenB');
    expect(metric?.concurrentSessionLimit).toBe(1);
  });
});

describe('SC-3: unknown five hour reset defaults to 5 hours', () => {
  /**
   * When fiveHourReset is not known (null snapshot → fiveHourReset unknown), default to 5 hours.
   * Input: fiveHourFreeRatio=1.0 (no snapshot), fiveHourShareConsumedPerSessionHour=0.05
   * Math: hoursUntilFiveHourReset=5; floor(min(1.0/5, 0.2) / 0.05) = floor(0.2/0.05) = 4
   * Currently: liveSessionConcurrentLimitOf(1.0, 1, SETTINGS) = 10 → FAILS
   */
  it('gives a limit of 4 for full free ratio when reset time is unknown', () => {
    const result = useCase.run(
      [
        candidate('tokenC', null),   // snapshot=null → no known reset time
      ],
      [],
      NOW,
      SETTINGS,
    );

    const metric = result.metrics.find((m) => m.name === 'tokenC');
    expect(metric?.concurrentSessionLimit).toBe(4);
  });

  it('gives a limit of 4 for full free ratio when fiveHourReset is zero (unset)', () => {
    const result = useCase.run(
      [
        candidate('tokenD', snapshot({
          fiveHourUtilization: 0,
          fiveHourReset: 0,             // zero means unset / unknown
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 7 * DAY,
        })),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const metric = result.metrics.find((m) => m.name === 'tokenD');
    expect(metric?.concurrentSessionLimit).toBe(4);
  });
});

describe('SC-5: overflow token selection uses lowest (count+1)/limit ratio', () => {
  /**
   * Token A: fiveHourReset=NOW+3.4h → new limit=4; 5 live sessions → no headroom; ratio=(5+1)/4=1.5; 7d reset far
   * Token B: fiveHourReset=NOW+10h  → new limit=1; 1 live session  → no headroom; ratio=(1+1)/1=2.0; 7d reset soon
   *
   * Both eligible (fiveHourFreeRatio=0.68 >= minFiveHourFreeRatio=0.6, sevenDayFreeRatio=1.0 >= 0.14).
   * New behavior: Token A wins (lower ratio 1.5 < 2.0).
   * Current behavior: seven-day reset order → Token B wins (resets sooner) → FAILS.
   */
  it('selects the token with the lowest overflow ratio when both are over their concurrent limits', () => {
    const tokenA = candidate('tokenA', snapshot({
      fiveHourUtilization: 0.32,            // fiveHourFreeRatio = 0.68
      fiveHourReset: NOW + 3.4 * HOUR,      // → new limit=4
      sevenDayUtilization: 0,
      sevenDayReset: NOW + 6 * DAY,         // further away
    }));
    const tokenB = candidate('tokenB', snapshot({
      fiveHourUtilization: 0.32,            // fiveHourFreeRatio = 0.68
      fiveHourReset: NOW + 10 * HOUR,       // → new limit=1
      sevenDayUtilization: 0,
      sevenDayReset: NOW + 2 * HOUR,        // sooner
    }));

    const result = useCase.run(
      [tokenA, tokenB],
      [
        ...sessionsFor('tokenA', 5),         // over the new limit of 4
        ...sessionsFor('tokenB', 1),         // at the new limit of 1 (not below)
      ],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('tokenA');
  });
});

describe('SC-6a: fiveHourShareConsumedPerSessionHour effect on concurrent limit', () => {
  /**
   * With fiveHourShareConsumedPerSessionHour=0.1 and SC-1 inputs:
   * floor(min(0.68/4.6, 0.2) / 0.1) = floor(0.14782/0.1) = floor(1.478) = 1
   * This is half of SC-1's limit (2), so doubling the share per session halves the limit.
   *
   * Currently: the field is not read from fleet config, so the limit stays at 10 → FAILS.
   */

  let tempDir: string;

  const writeFleetConfig = (content: string): string => {
    const fleetConfigFilePath = path.join(tempDir, 'fleet.config.yaml');
    fs.writeFileSync(fleetConfigFilePath, content);
    return fleetConfigFilePath;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fleet-config-sc6a-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads fiveHourShareConsumedPerSessionHour=0.1 from fleet config and halves the SC-1 limit', () => {
    const configPath = writeFleetConfig([
      'liveSessionOauthTokenSelection:',
      '  fiveHourShareConsumedPerSessionHour: 0.1',
    ].join('\n'));

    const settings = loadLiveSessionOauthTokenSelectionSettings(
      configPath,
    ) as LiveSessionOauthTokenSelectionSettings;

    const result = useCase.run(
      [
        candidate('tokenE', snapshot({
          fiveHourUtilization: 0.32,          // fiveHourFreeRatio = 0.68
          fiveHourReset: NOW + 4.6 * HOUR,
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 7 * DAY,
        })),
      ],
      [],
      NOW,
      settings,
    );

    const metric = result.metrics.find((m) => m.name === 'tokenE');
    // With share=0.1 (double the default 0.05), the limit halves from SC-1's 2 to 1.
    expect(metric?.concurrentSessionLimit).toBe(1);
  });
});

// ─── Regression tests ────────────────────────────────────────────────────────

describe('R2 (regression): seven-day reset order is preserved when both tokens have headroom', () => {
  /**
   * This is existing behavior that MUST NOT change.
   * When both tokens have concurrency headroom, the soonest-resetting token is preferred.
   */
  it('selects the token with the sooner seven-day reset when both are under their limits', () => {
    const result = useCase.run(
      [
        candidate('distantReset', snapshot({
          fiveHourUtilization: 0,
          fiveHourReset: NOW + 4 * HOUR,
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 6 * DAY,
        })),
        candidate('nearReset', snapshot({
          fiveHourUtilization: 0,
          fiveHourReset: NOW + 4 * HOUR,
          sevenDayUtilization: 0,
          sevenDayReset: NOW + 2 * HOUR,
        })),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('nearReset');
  });
});
