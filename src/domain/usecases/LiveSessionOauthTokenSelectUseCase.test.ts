import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
  LiveSessionOauthTokenSelectUseCase,
  LiveSessionOauthTokenSelectionSettings,
  liveSessionConcurrentLimitOf,
} from './LiveSessionOauthTokenSelectUseCase';
import {
  OauthTokenCandidate,
  OauthTokenWindowSnapshot,
} from './OauthTokenSelectUseCase';

const NOW = 1_000_000;
const HOUR = 3600;
const DAY = 86400;

const SETTINGS = DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS;
const MAX_CONCURRENT_SESSION_COUNT = SETTINGS.maxConcurrentSessionCount;

const settingsWith = (
  overrides: Partial<LiveSessionOauthTokenSelectionSettings>,
): LiveSessionOauthTokenSelectionSettings => ({ ...SETTINGS, ...overrides });

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
  subscriptionDisabled = false,
  unifiedRejected = false,
  fableRejected = false,
): OauthTokenCandidate => ({
  name,
  token: `fake-token-${name}`,
  snapshot: snapshotValue,
  subscriptionDisabled,
  unifiedRejected,
  fableRejected,
});

const session = (name: string, sessionKey: string): ClaudeLiveSession => ({
  token: `fake-token-${name}`,
  sessionKey,
});

const sessionsFor = (name: string, count: number): ClaudeLiveSession[] =>
  Array.from({ length: count }, (_unused, index) =>
    session(name, `${name}-session-${index}`),
  );

const withSelectionWeight = (
  base: OauthTokenCandidate,
  selectionWeight: number,
): OauthTokenCandidate => ({ ...base, selectionWeight });

describe('LiveSessionOauthTokenSelectUseCase', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('selects the token whose seven day window resets soonest even when an idle token has a distant reset', () => {
    const result = useCase.run(
      [
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
        candidate('soonResetBusy', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
      ],
      sessionsFor('soonResetBusy', 5),
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('soonResetBusy');
  });

  it('keeps filling the soonest resetting token until it reaches its concurrent session limit', () => {
    const belowLimit = useCase.run(
      [
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
        candidate('soonReset', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
      ],
      sessionsFor('soonReset', MAX_CONCURRENT_SESSION_COUNT - 1),
      NOW,
      SETTINGS,
    );

    expect(belowLimit.selected?.name).toBe('soonReset');
  });

  it('moves to the next soonest resetting token once the soonest one is at its concurrent session limit', () => {
    const result = useCase.run(
      [
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
        candidate('soonResetFull', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
      ],
      sessionsFor('soonResetFull', MAX_CONCURRENT_SESSION_COUNT),
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('distantResetIdle');
    const full = result.metrics.find((m) => m.name === 'soonResetFull');
    expect(full?.hasConcurrencyHeadroom).toBe(false);
    expect(full?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
  });

  it('boosts the concurrent session limit toward maxConcurrentSessionCount when the seven day reset is imminent', () => {
    const result = useCase.run(
      [
        candidate(
          'soonResetNarrowFiveHour',
          snapshot({
            sevenDayReset: NOW + 2 * HOUR,
            fiveHourUtilization: 0.7,
          }),
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('soonResetNarrowFiveHour', 6),
      NOW,
      SETTINGS,
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'soonResetNarrowFiveHour',
    );
    expect(narrow?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('excludes a seven day window that has fallen below the minimum free ratio even when sessions are below the concurrent limit', () => {
    const result = useCase.run(
      [
        candidate(
          'nearlyUsedSevenDay',
          snapshot({
            sevenDayReset: NOW + 3 * DAY,
            sevenDayUtilization: 0.9,
          }),
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('nearlyUsedSevenDay', 5),
      NOW,
      SETTINGS,
    );

    const nearlyUsed = result.metrics.find(
      (m) => m.name === 'nearlyUsedSevenDay',
    );
    expect(nearlyUsed?.eligible).toBe(false);
    expect(nearlyUsed?.exclusionReason).toContain('7d window');
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('allows a token whose seven day window is below the minimum when it resets within 24 hours to drain remaining capacity', () => {
    const result = useCase.run(
      [
        candidate(
          'aboutToResetNearlyUsedSevenDay',
          snapshot({
            sevenDayReset: NOW + HOUR,
            sevenDayUtilization: 0.9,
          }),
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('aboutToResetNearlyUsedSevenDay', 5),
      NOW,
      SETTINGS,
    );

    const aboutToReset = result.metrics.find(
      (m) => m.name === 'aboutToResetNearlyUsedSevenDay',
    );
    expect(aboutToReset?.eligible).toBe(true);
    expect(result.selected?.name).toBe('aboutToResetNearlyUsedSevenDay');
  });

  it('still throttles a seven day window that resets within the hour once its five hour window falls below half free', () => {
    const result = useCase.run(
      [
        candidate(
          'aboutToResetNarrowFiveHour',
          snapshot({
            sevenDayReset: NOW + HOUR,
            fiveHourUtilization: 0.7,
          }),
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('aboutToResetNarrowFiveHour', 6),
      NOW,
      SETTINGS,
    );

    const aboutToReset = result.metrics.find(
      (m) => m.name === 'aboutToResetNarrowFiveHour',
    );
    expect(aboutToReset?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('scales the concurrent session limit down by the configured selection weight', () => {
    const result = useCase.run(
      [
        withSelectionWeight(
          candidate(
            'downWeighted',
            snapshot({ sevenDayReset: NOW + 2 * HOUR }),
          ),
          0.5,
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('downWeighted', 5),
      NOW,
      SETTINGS,
    );

    const downWeighted = result.metrics.find((m) => m.name === 'downWeighted');
    expect(downWeighted?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
    expect(result.selected?.name).toBe('downWeighted');
  });

  it('honours a fleet supplied maximum concurrent session count', () => {
    const result = useCase.run(
      [candidate('onlyToken', snapshot({}))],
      [],
      NOW,
      settingsWith({ maxConcurrentSessionCount: 24 }),
    );

    const onlyToken = result.metrics.find((m) => m.name === 'onlyToken');
    expect(onlyToken?.concurrentSessionLimit).toBe(24);
  });

  it('honours a fleet supplied five hour free ratio for the full concurrent session limit', () => {
    const result = useCase.run(
      [candidate('narrowFiveHour', snapshot({ fiveHourUtilization: 0.6 }))],
      [],
      NOW,
      settingsWith({ fullSpeedFiveHourFreeRatio: 0.8 }),
    );

    const narrowFiveHour = result.metrics.find(
      (m) => m.name === 'narrowFiveHour',
    );
    expect(narrowFiveHour?.concurrentSessionLimit).toBe(5);
  });

  it('never starves a sole eligible token whose selection weight rounds its limit below one', () => {
    const result = useCase.run(
      [
        withSelectionWeight(candidate('tinyWeight', snapshot({})), 0.01),
        candidate('blocked', snapshot({ fiveHourUtilization: 0.9 })),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('tinyWeight');
    const tiny = result.metrics.find((m) => m.name === 'tinyWeight');
    expect(tiny?.concurrentSessionLimit).toBe(1);
  });

  it('still selects the soonest resetting token when every eligible token is at its limit', () => {
    const result = useCase.run(
      [
        candidate(
          'distantResetFull',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
        candidate('soonResetFull', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
      ],
      [
        ...sessionsFor('distantResetFull', MAX_CONCURRENT_SESSION_COUNT),
        ...sessionsFor('soonResetFull', MAX_CONCURRENT_SESSION_COUNT),
      ],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('soonResetFull');
  });

  it('breaks a seven day reset tie by the fewer live sessions', () => {
    const result = useCase.run(
      [
        candidate('sameResetBusy', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
        candidate('sameResetIdle', snapshot({ sevenDayReset: NOW + 2 * HOUR })),
      ],
      sessionsFor('sameResetBusy', 1),
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('sameResetIdle');
  });

  it('returns the same token on repeated calls with the same inputs', () => {
    const candidates = [
      candidate('firstOfEqualPair', snapshot({})),
      candidate('secondOfEqualPair', snapshot({})),
    ];

    const first = useCase.run(candidates, [], NOW, SETTINGS);
    const second = useCase.run(candidates, [], NOW, SETTINGS);

    expect(first.selected?.name).toBe(second.selected?.name);
    expect(first.selected?.name).toBe('firstOfEqualPair');
  });

  it('excludes a rate-limit-ineligible token even when it has no live sessions', () => {
    const result = useCase.run(
      [
        candidate('idleButBlocked', snapshot({ fiveHourUtilization: 0.9 })),
        candidate('busyButFree', snapshot({})),
      ],
      [session('busyButFree', 'session-a')],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('busyButFree');
    const blocked = result.metrics.find((m) => m.name === 'idleButBlocked');
    expect(blocked?.eligible).toBe(false);
    expect(blocked?.liveSessionCount).toBe(0);
  });

  it('counts distinct session keys and dedupes child processes sharing one session key', () => {
    const result = useCase.run(
      [
        candidate('oneSession', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        candidate('twoSessions', snapshot({ sevenDayReset: NOW + 6 * DAY })),
      ],
      [
        session('oneSession', 'session-a'),
        session('oneSession', 'session-a'),
        session('oneSession', 'session-a'),
        session('twoSessions', 'session-b'),
        session('twoSessions', 'session-c'),
      ],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('oneSession');
    const oneSession = result.metrics.find((m) => m.name === 'oneSession');
    const twoSessions = result.metrics.find((m) => m.name === 'twoSessions');
    expect(oneSession?.liveSessionCount).toBe(1);
    expect(twoSessions?.liveSessionCount).toBe(2);
  });

  it('counts resumed sessions keyed by config dir so they are not under-counted', () => {
    const result = useCase.run(
      [
        candidate('resumedHeavy', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        candidate('fresh', snapshot({ sevenDayReset: NOW + 6 * DAY })),
      ],
      [
        session('resumedHeavy', '/home/user/.config/claude-1'),
        session('resumedHeavy', '/home/user/.config/claude-1'),
        session('resumedHeavy', '/home/user/.config/claude-2'),
        session('fresh', 'session-fresh'),
      ],
      NOW,
      SETTINGS,
    );

    const resumedHeavy = result.metrics.find((m) => m.name === 'resumedHeavy');
    const fresh = result.metrics.find((m) => m.name === 'fresh');
    expect(resumedHeavy?.liveSessionCount).toBe(2);
    expect(fresh?.liveSessionCount).toBe(1);
    expect(result.selected?.name).toBe('resumedHeavy');
  });

  it('returns null selection when no token passes the rate-limit filter', () => {
    const result = useCase.run(
      [candidate('blocked', snapshot({ fiveHourUtilization: 0.9 }))],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected).toBeNull();
  });

  it('returns null selection for an empty candidate list', () => {
    const result = useCase.run([], [], NOW, SETTINGS);

    expect(result.selected).toBeNull();
    expect(result.metrics).toEqual([]);
  });

  it('reports a zero live session count for tokens with no matching process', () => {
    const result = useCase.run(
      [candidate('lonely', snapshot({}))],
      [session('other', 'session-x')],
      NOW,
      SETTINGS,
    );

    const lonely = result.metrics.find((m) => m.name === 'lonely');
    expect(lonely?.liveSessionCount).toBe(0);
  });

  it('excludes a subscription-disabled token even when it has zero live sessions', () => {
    const result = useCase.run(
      [
        candidate('disabled', snapshot({}), true),
        candidate('active', snapshot({}), false),
      ],
      [session('active', 'session-a')],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('active');
    const disabled = result.metrics.find((m) => m.name === 'disabled');
    expect(disabled?.eligible).toBe(false);
    expect(disabled?.exclusionReason).toContain(
      'organization has disabled Claude subscription access for Claude Code',
    );
  });

  it('excludes a unified-rejected token even when it has zero live sessions', () => {
    const result = useCase.run(
      [
        candidate('rejected', snapshot({}), false, true),
        candidate('active', snapshot({}), false, false),
      ],
      [session('active', 'session-a')],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('active');
    const rejected = result.metrics.find((m) => m.name === 'rejected');
    expect(rejected?.eligible).toBe(false);
    expect(rejected?.exclusionReason).toContain('rejected');
  });
});

describe('LiveSessionOauthTokenCandidateMetrics selectionWeight', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('includes the configured selection weight in each candidate metric', () => {
    const result = useCase.run(
      [
        withSelectionWeight(candidate('heavy', snapshot({})), 2),
        candidate('normal', snapshot({})),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const heavy = result.metrics.find((m) => m.name === 'heavy');
    const normal = result.metrics.find((m) => m.name === 'normal');
    expect(heavy?.selectionWeight).toBe(2);
    expect(normal?.selectionWeight).toBe(1);
  });

  it('reports selection weight one for a candidate without an explicit selectionWeight', () => {
    const result = useCase.run(
      [candidate('implicit', snapshot({}))],
      [],
      NOW,
      SETTINGS,
    );

    const implicit = result.metrics.find((m) => m.name === 'implicit');
    expect(implicit?.selectionWeight).toBe(1);
  });
});

describe('LiveSessionOauthTokenSelectUseCase minimum free ratio thresholds', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('excludes a token whose five hour window has less than the minimum free ratio', () => {
    const result = useCase.run(
      [
        candidate('narrowFiveHourMin', snapshot({ fiveHourUtilization: 0.5 })),
        candidate('freeFiveHourMin', snapshot({})),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const narrow = result.metrics.find((m) => m.name === 'narrowFiveHourMin');
    expect(narrow?.eligible).toBe(false);
    expect(narrow?.exclusionReason).toContain('5h window');
    expect(result.selected?.name).toBe('freeFiveHourMin');
  });

  it('excludes a token whose seven day window has less than the minimum free ratio', () => {
    const result = useCase.run(
      [
        candidate(
          'nearlyUsedSevenDayMin',
          snapshot({ sevenDayUtilization: 0.9 }),
        ),
        candidate('freeSevenDayMin', snapshot({})),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const nearlyUsed = result.metrics.find(
      (m) => m.name === 'nearlyUsedSevenDayMin',
    );
    expect(nearlyUsed?.eligible).toBe(false);
    expect(nearlyUsed?.exclusionReason).toContain('7d window');
    expect(result.selected?.name).toBe('freeSevenDayMin');
  });

  it('selects a token whose ratios are at exactly the minimum free ratio thresholds', () => {
    const result = useCase.run(
      [
        candidate(
          'atThreshold',
          snapshot({ fiveHourUtilization: 0.4, sevenDayUtilization: 0.86 }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const atThreshold = result.metrics.find((m) => m.name === 'atThreshold');
    expect(atThreshold?.eligible).toBe(true);
    expect(result.selected?.name).toBe('atThreshold');
  });

  it('honours a fleet supplied minimum five hour free ratio', () => {
    const result = useCase.run(
      [
        candidate(
          'narrowForFleetFiveHour',
          snapshot({ fiveHourUtilization: 0.15 }),
        ),
        candidate('freeForFleetFiveHour', snapshot({})),
      ],
      [],
      NOW,
      settingsWith({ minFiveHourFreeRatio: 0.9 }),
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'narrowForFleetFiveHour',
    );
    expect(narrow?.eligible).toBe(false);
    expect(narrow?.exclusionReason).toContain('5h window');
    expect(result.selected?.name).toBe('freeForFleetFiveHour');
  });

  it('honours a fleet supplied minimum seven day free ratio', () => {
    const result = useCase.run(
      [
        candidate(
          'narrowForFleetSevenDay',
          snapshot({ sevenDayUtilization: 0.5 }),
        ),
        candidate('freeForFleetSevenDay', snapshot({})),
      ],
      [],
      NOW,
      settingsWith({ minSevenDayFreeRatio: 0.6 }),
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'narrowForFleetSevenDay',
    );
    expect(narrow?.eligible).toBe(false);
    expect(narrow?.exclusionReason).toContain('7d window');
    expect(result.selected?.name).toBe('freeForFleetSevenDay');
  });

  it('reports the five hour window exclusion reason when both windows are below their minimums', () => {
    const result = useCase.run(
      [
        candidate(
          'bothNarrow',
          snapshot({ fiveHourUtilization: 0.5, sevenDayUtilization: 0.9 }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const bothNarrow = result.metrics.find((m) => m.name === 'bothNarrow');
    expect(bothNarrow?.eligible).toBe(false);
    expect(bothNarrow?.exclusionReason).toContain('5h window');
    expect(bothNarrow?.exclusionReason).not.toContain('7d window');
  });
});

describe('liveSessionConcurrentLimitOf', () => {
  it('gives the full limit while the five hour window is at or above the full speed free ratio', () => {
    expect(liveSessionConcurrentLimitOf(1, 1, SETTINGS)).toBe(
      MAX_CONCURRENT_SESSION_COUNT,
    );
    expect(
      liveSessionConcurrentLimitOf(
        SETTINGS.fullSpeedFiveHourFreeRatio,
        1,
        SETTINGS,
      ),
    ).toBe(MAX_CONCURRENT_SESSION_COUNT);
  });

  it('tapers the limit in proportion to the five hour free ratio below the full speed free ratio', () => {
    expect(liveSessionConcurrentLimitOf(0.25, 1, SETTINGS)).toBe(5);
    expect(liveSessionConcurrentLimitOf(0.3, 1, SETTINGS)).toBe(6);
  });

  it('never returns less than one even when the five hour window is fully used', () => {
    expect(liveSessionConcurrentLimitOf(0, 1, SETTINGS)).toBe(1);
    expect(liveSessionConcurrentLimitOf(1, 0, SETTINGS)).toBe(1);
  });

  it('raises the limit for a weight above one', () => {
    expect(liveSessionConcurrentLimitOf(1, 1.5, SETTINGS)).toBe(15);
  });

  it('uses the fleet supplied maximum concurrent session count', () => {
    expect(
      liveSessionConcurrentLimitOf(
        1,
        1,
        settingsWith({ maxConcurrentSessionCount: 24 }),
      ),
    ).toBe(24);
  });

  it('uses the fleet supplied five hour free ratio for the full limit', () => {
    expect(
      liveSessionConcurrentLimitOf(
        0.4,
        1,
        settingsWith({ fullSpeedFiveHourFreeRatio: 0.8 }),
      ),
    ).toBe(5);
  });

  it('boosts the concurrent session limit when given a seven day urgency boost above one, capped at maxConcurrentSessionCount', () => {
    const baseline = liveSessionConcurrentLimitOf(0.25, 1, SETTINGS);
    const boosted = liveSessionConcurrentLimitOf(0.25, 1, SETTINGS, 3);
    expect(boosted).toBeGreaterThan(baseline);
    expect(boosted).toBe(MAX_CONCURRENT_SESSION_COUNT);
  });

  it('does not exceed maxConcurrentSessionCount when the urgency boost is very large', () => {
    expect(liveSessionConcurrentLimitOf(1, 1, SETTINGS, 168)).toBe(
      MAX_CONCURRENT_SESSION_COUNT,
    );
  });
});

describe('LiveSessionOauthTokenSelectUseCase seven day urgency boost integration', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('raises the concurrent session limit for a near-deadline token with a fractional selection weight', () => {
    const result = useCase.run(
      [
        withSelectionWeight(
          candidate(
            'nearDeadlineDownWeighted',
            snapshot({ sevenDayReset: NOW + 20 * HOUR }),
          ),
          0.5,
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('nearDeadlineDownWeighted', 8),
      NOW,
      SETTINGS,
    );

    const nearDeadline = result.metrics.find(
      (m) => m.name === 'nearDeadlineDownWeighted',
    );
    expect(nearDeadline?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
    expect(nearDeadline?.hasConcurrencyHeadroom).toBe(true);
    expect(result.selected?.name).toBe('nearDeadlineDownWeighted');
  });
});
