import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  DEFAULT_LIVE_SESSION_OAUTH_TOKEN_SELECTION_SETTINGS,
  LiveSessionOauthTokenCandidateMetrics,
  LiveSessionOauthTokenSelectUseCase,
  LiveSessionOauthTokenSelectionSettings,
  fiveHourSustainableSessionCountOf,
  liveSessionConcurrentLimitOf,
  liveSessionOauthTokenCandidateMetricsInSelectionOrder,
  sevenDayBudgetUndrainableBeforeSpendDeadlineOf,
  sevenDayShareDrainableBeforeSpendDeadlineOf,
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

const FIVE_HOUR_SHARE_CONSUMED_PER_SESSION_HOUR_THAT_NEVER_BINDS = 0.001;

const settingsWhereFiveHourSustainabilityNeverBindsWith = (
  overrides: Partial<LiveSessionOauthTokenSelectionSettings>,
): LiveSessionOauthTokenSelectionSettings =>
  settingsWith({
    fiveHourShareConsumedPerSessionHour:
      FIVE_HOUR_SHARE_CONSUMED_PER_SESSION_HOUR_THAT_NEVER_BINDS,
    ...overrides,
  });

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
  blockedUntilEpoch: 0,
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

  it('prefers a near-expiry token over a fresh token even when the near-expiry token has little remaining seven day capacity', () => {
    const result = useCase.run(
      [
        candidate(
          'nearExpiryLowCapacity',
          snapshot({
            sevenDayReset: NOW + 5 * HOUR,
            sevenDayUtilization: 0.9,
          }),
        ),
        candidate(
          'freshHighCapacity',
          snapshot({ sevenDayReset: NOW + 7 * DAY }),
        ),
      ],
      [
        ...sessionsFor('nearExpiryLowCapacity', 1),
        ...sessionsFor('freshHighCapacity', 5),
      ],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('nearExpiryLowCapacity');
  });

  it('prefers the token with fewer live sessions when seven day reset times are equal', () => {
    const result = useCase.run(
      [
        candidate('lowFreeRatioIdle', snapshot({ sevenDayUtilization: 0.5 })),
        candidate('highFreeRatioBusy', snapshot({ sevenDayUtilization: 0 })),
      ],
      sessionsFor('highFreeRatioBusy', 5),
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('lowFreeRatioIdle');
  });

  it('keeps filling the token with fewer live sessions when seven day reset times are equal until it reaches its concurrent session limit', () => {
    const belowLimit = useCase.run(
      [
        candidate('lowerFreeRatioIdle', snapshot({ sevenDayUtilization: 0.5 })),
        candidate('highFreeRatioBusy', snapshot({ sevenDayUtilization: 0 })),
      ],
      sessionsFor('highFreeRatioBusy', MAX_CONCURRENT_SESSION_COUNT - 1),
      NOW,
      SETTINGS,
    );

    expect(belowLimit.selected?.name).toBe('lowerFreeRatioIdle');
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
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    expect(result.selected?.name).toBe('distantResetIdle');
    const full = result.metrics.find((m) => m.name === 'soonResetFull');
    expect(full?.hasConcurrencyHeadroom).toBe(false);
    expect(full?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
  });

  it('boosts the concurrent session limit toward maxConcurrentSessionCount when the seven day reset is imminent and keeps selecting that token while it is under the boosted limit', () => {
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
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'soonResetNarrowFiveHour',
    );
    expect(narrow?.concurrentSessionLimit).toBe(MAX_CONCURRENT_SESSION_COUNT);
    expect(result.selected?.name).toBe('soonResetNarrowFiveHour');
  });

  it('keeps a token whose seven day window is only 10% free eligible and moves to the next token once it is at its concurrent session limit', () => {
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
    expect(nearlyUsed?.eligible).toBe(true);
    expect(nearlyUsed?.exclusionReason).toBeNull();
    expect(nearlyUsed?.hasConcurrencyHeadroom).toBe(false);
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('allows a nearly used token within 48 hours of its seven day reset so remaining capacity can be drained', () => {
    const result = useCase.run(
      [
        candidate(
          'earlyDrainSevenDay',
          snapshot({
            sevenDayReset: NOW + 30 * HOUR,
            sevenDayUtilization: 0.9,
          }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const earlyDrain = result.metrics.find(
      (m) => m.name === 'earlyDrainSevenDay',
    );
    expect(earlyDrain?.eligible).toBe(true);
    expect(result.selected?.name).toBe('earlyDrainSevenDay');
  });

  it('prefers the token within the 48-hour deadline window over a token with a distant reset', () => {
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
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    const aboutToReset = result.metrics.find(
      (m) => m.name === 'aboutToResetNearlyUsedSevenDay',
    );
    expect(aboutToReset?.eligible).toBe(true);
    expect(result.selected?.name).toBe('aboutToResetNearlyUsedSevenDay');
  });

  it('selects a seven day window that resets within the hour while it is under its boosted concurrent session limit even though its five hour window is below half free', () => {
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
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    const aboutToReset = result.metrics.find(
      (m) => m.name === 'aboutToResetNarrowFiveHour',
    );
    expect(aboutToReset?.concurrentSessionLimit).toBe(
      MAX_CONCURRENT_SESSION_COUNT,
    );
    expect(result.selected?.name).toBe('aboutToResetNarrowFiveHour');
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
          'lowerFreeRatioIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY, sevenDayUtilization: 0.5 }),
        ),
      ],
      sessionsFor('downWeighted', 5),
      NOW,
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    const downWeighted = result.metrics.find((m) => m.name === 'downWeighted');
    expect(downWeighted?.concurrentSessionLimit).toBe(
      MAX_CONCURRENT_SESSION_COUNT,
    );
    expect(downWeighted?.hasConcurrencyHeadroom).toBe(true);
    expect(result.selected?.name).toBe('lowerFreeRatioIdle');
  });

  it('honours a fleet supplied maximum concurrent session count', () => {
    const result = useCase.run(
      [candidate('onlyToken', snapshot({}))],
      [],
      NOW,
      settingsWhereFiveHourSustainabilityNeverBindsWith({
        maxConcurrentSessionCount: 24,
      }),
    );

    const onlyToken = result.metrics.find((m) => m.name === 'onlyToken');
    expect(onlyToken?.concurrentSessionLimit).toBe(24);
  });

  it('honours a fleet supplied five hour free ratio for the full concurrent session limit', () => {
    const result = useCase.run(
      [
        candidate(
          'narrowFiveHour',
          snapshot({
            fiveHourUtilization: 0.6,
            sevenDayReset: NOW + 216 * HOUR,
          }),
        ),
      ],
      [],
      NOW,
      settingsWhereFiveHourSustainabilityNeverBindsWith({
        fullSpeedFiveHourFreeRatio: 0.8,
      }),
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

  it('selects the first eligible token when every token is at its concurrent session limit and all other tie-breakers are equal', () => {
    const result = useCase.run(
      [
        candidate('lowFreeRatioFull', snapshot({ sevenDayUtilization: 0.5 })),
        candidate('highFreeRatioFull', snapshot({ sevenDayUtilization: 0 })),
      ],
      [
        ...sessionsFor('lowFreeRatioFull', MAX_CONCURRENT_SESSION_COUNT),
        ...sessionsFor('highFreeRatioFull', MAX_CONCURRENT_SESSION_COUNT),
      ],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('lowFreeRatioFull');
  });

  it('breaks a seven day reset epoch tie by the fewer live sessions', () => {
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

  it('keeps a token whose five hour window is only 10% free eligible and selects it while it is under its concurrent session limit of one', () => {
    const result = useCase.run(
      [
        candidate('idleNarrowFiveHour', snapshot({ fiveHourUtilization: 0.9 })),
        candidate('busyFresh', snapshot({})),
      ],
      [session('busyFresh', 'session-a')],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('idleNarrowFiveHour');
    const narrow = result.metrics.find((m) => m.name === 'idleNarrowFiveHour');
    expect(narrow?.eligible).toBe(true);
    expect(narrow?.exclusionReason).toBeNull();
    expect(narrow?.liveSessionCount).toBe(0);
    expect(narrow?.concurrentSessionLimit).toBe(1);
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

  it('selects a sole token whose five hour window is 10% free and seven day window is 2% free because free ratios no longer exclude a token', () => {
    const result = useCase.run(
      [
        candidate(
          'nearlySpentBothWindows',
          snapshot({ fiveHourUtilization: 0.9, sevenDayUtilization: 0.98 }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('nearlySpentBothWindows');
  });

  it('selects the token with the least seven day budget among the tokens the API has not rejected when their seven day resets are equally distant', () => {
    const rejected = Array.from({ length: 7 }, (_unused, index) =>
      candidate(`rejected${index}`, snapshot({}), false, true),
    );
    const result = useCase.run(
      [
        ...rejected,
        candidate(
          'dev2',
          snapshot({ sevenDayUtilization: 0.91, fiveHourUtilization: 0.3 }),
        ),
        candidate(
          'dev9',
          snapshot({ sevenDayUtilization: 0.96, fiveHourUtilization: 0.02 }),
        ),
        candidate(
          'main',
          snapshot({ sevenDayUtilization: 0.2, fiveHourUtilization: 0.68 }),
        ),
        candidate(
          'de11',
          snapshot({ sevenDayUtilization: 0.2, fiveHourUtilization: 0.56 }),
        ),
        candidate(
          'de12',
          snapshot({ sevenDayUtilization: 0.2, fiveHourUtilization: 0.65 }),
        ),
        candidate(
          'de13',
          snapshot({ sevenDayUtilization: 0.2, fiveHourUtilization: 0.92 }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('dev9');
  });

  it('returns null selection when the only token is rejected by the API even though its seven day window is half free', () => {
    const result = useCase.run(
      [
        candidate(
          'hardRejected',
          snapshot({ sevenDayUtilization: 0.5, fiveHourUtilization: 0.9 }),
          false,
          true,
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected).toBeNull();
  });

  it('breaks a seven day free ratio and reset tie by the fewer live sessions', () => {
    const result = useCase.run(
      [
        candidate(
          'busyFallback',
          snapshot({ sevenDayUtilization: 0.9, fiveHourUtilization: 0.5 }),
        ),
        candidate(
          'idleFallback',
          snapshot({ sevenDayUtilization: 0.9, fiveHourUtilization: 0.5 }),
        ),
      ],
      sessionsFor('busyFallback', 3),
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe('idleFallback');
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

describe('LiveSessionOauthTokenSelectUseCase accepts the minimum free ratio settings keys without excluding a token', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  const belowFormerMinimumCases: [
    string,
    string,
    Partial<OauthTokenWindowSnapshot>,
    Partial<LiveSessionOauthTokenSelectionSettings>,
  ][] = [
    [
      'five hour window below the default minimum five hour free ratio',
      'narrowFiveHourMin',
      { fiveHourUtilization: 0.5 },
      {},
    ],
    [
      'seven day window below the default minimum seven day free ratio',
      'nearlyUsedSevenDayMin',
      { sevenDayUtilization: 0.9 },
      {},
    ],
    [
      'five hour window below a fleet supplied minimum five hour free ratio',
      'narrowForFleetFiveHour',
      { fiveHourUtilization: 0.15 },
      { minFiveHourFreeRatio: 0.9 },
    ],
    [
      'seven day window below a fleet supplied minimum seven day free ratio',
      'narrowForFleetSevenDay',
      { sevenDayUtilization: 0.5 },
      { minSevenDayFreeRatio: 0.6 },
    ],
    [
      'both windows below the default minimum free ratios',
      'bothNarrow',
      { fiveHourUtilization: 0.5, sevenDayUtilization: 0.9 },
      {},
    ],
  ];

  it.each(belowFormerMinimumCases)(
    'keeps a token eligible and selects it when its %s',
    (_description, name, snapshotOverrides, settingsOverrides) => {
      const result = useCase.run(
        [
          candidate(name, snapshot(snapshotOverrides)),
          candidate('fresh', snapshot({})),
        ],
        [],
        NOW,
        settingsWith(settingsOverrides),
      );

      const metric = result.metrics.find((m) => m.name === name);
      expect(metric?.eligible).toBe(true);
      expect(metric?.exclusionReason).toBeNull();
      expect(result.selected?.name).toBe(name);
    },
  );

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

  it('does not apply the urgency boost when the unflored throttle score is below one', () => {
    const fullSpeedRatioThatPutsUnfloredScoreBelow1 = 0.6;
    expect(
      liveSessionConcurrentLimitOf(
        0.05,
        1,
        settingsWith({
          fullSpeedFiveHourFreeRatio: fullSpeedRatioThatPutsUnfloredScoreBelow1,
        }),
        3.5,
      ),
    ).toBe(1);
  });

  it('still applies the urgency boost when the unflored throttle score is at or above one', () => {
    const fullSpeedRatioAboveActualFiveHourFreeRatio = 0.6;
    expect(
      liveSessionConcurrentLimitOf(
        0.15,
        1,
        settingsWith({
          fullSpeedFiveHourFreeRatio:
            fullSpeedRatioAboveActualFiveHourFreeRatio,
        }),
        3.5,
      ),
    ).toBeGreaterThan(1);
  });
});

describe('LiveSessionOauthTokenSelectUseCase selects a nearly spent 7d budget within the 48-hour deadline window first', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  const exhaustedWithinDeadlineCases: [string, number, number][] = [
    [
      'token at 3% seven day free within 47 hours of reset is eligible and selected before a fresh token',
      0.97,
      47,
    ],
    [
      'token at 1% seven day free within 30 hours of reset is eligible and selected before a fresh token',
      0.99,
      30,
    ],
  ];

  it.each(exhaustedWithinDeadlineCases)(
    '%s',
    (_description, sevenDayUtilization, sevenDayResetHours) => {
      const result = useCase.run(
        [
          candidate(
            'nearlyExhausted',
            snapshot({
              sevenDayUtilization,
              sevenDayReset: NOW + sevenDayResetHours * HOUR,
            }),
          ),
          candidate('fine', snapshot({})),
        ],
        [],
        NOW,
        SETTINGS,
      );

      const metric = result.metrics.find((m) => m.name === 'nearlyExhausted');
      expect(metric?.eligible).toBe(true);
      expect(metric?.exclusionReason).toBeNull();
      expect(result.selected?.name).toBe('nearlyExhausted');
    },
  );
});

describe('LiveSessionOauthTokenSelectUseCase 7d deadline window boundary and 5h deadline bypass pinning', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  const deadlineBoundaryCases: [
    string,
    number,
    number,
    number,
    number,
    boolean,
    string | null,
  ][] = [
    [
      'token at 3% seven day free more than 48 hours before reset is eligible',
      0.97,
      50,
      0,
      5 * 60,
      true,
      null,
    ],
    [
      'token within 1 hour of its five hour reset is eligible for live session selection despite five hour window being below the minimum',
      0,
      7 * 24,
      0.5,
      30,
      true,
      null,
    ],
  ];

  it.each(deadlineBoundaryCases)(
    '%s',
    (
      _description,
      sevenDayUtilization,
      sevenDayResetHours,
      fiveHourUtilization,
      fiveHourResetMinutes,
      expectedEligible,
      expectedExclusionReasonSubstring,
    ) => {
      const result = useCase.run(
        [
          candidate(
            'subject',
            snapshot({
              sevenDayUtilization,
              sevenDayReset: NOW + sevenDayResetHours * HOUR,
              fiveHourUtilization,
              fiveHourReset: NOW + fiveHourResetMinutes * 60,
            }),
          ),
        ],
        [],
        NOW,
        SETTINGS,
      );

      const metric = result.metrics.find((m) => m.name === 'subject');
      expect(metric?.eligible).toBe(expectedEligible);
      if (expectedExclusionReasonSubstring !== null) {
        expect(metric?.exclusionReason).toContain(
          expectedExclusionReasonSubstring,
        );
      }
    },
  );
});

describe('LiveSessionOauthTokenSelectUseCase selects a depleted-budget token within the 48-hour deadline window', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('selects the only candidate when it has 3% seven-day-window free within 47 hours of reset', () => {
    const result = useCase.run(
      [
        candidate(
          'depletedSoleCandidateWithinDeadlineWindow',
          snapshot({
            sevenDayUtilization: 0.97,
            sevenDayReset: NOW + 47 * HOUR,
          }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    expect(result.selected?.name).toBe(
      'depletedSoleCandidateWithinDeadlineWindow',
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
      [
        ...sessionsFor('nearDeadlineDownWeighted', 6),
        ...sessionsFor('distantResetIdle', 7),
      ],
      NOW,
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
    );

    const nearDeadline = result.metrics.find(
      (m) => m.name === 'nearDeadlineDownWeighted',
    );
    expect(nearDeadline?.concurrentSessionLimit).toBe(
      MAX_CONCURRENT_SESSION_COUNT,
    );
    expect(nearDeadline?.hasConcurrencyHeadroom).toBe(true);
    expect(result.selected?.name).toBe('nearDeadlineDownWeighted');
  });
});

describe('fiveHourSustainableSessionCountOf', () => {
  it.each([
    {
      situation: 'two thirds of the window free with 4.6 hours left',
      fiveHourFreeRatio: 0.68,
      hoursUntilFiveHourReset: 4.605,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 2,
    },
    {
      situation: 'a quarter of the window free with 4.3 hours left',
      fiveHourFreeRatio: 0.27,
      hoursUntilFiveHourReset: 4.294,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 1,
    },
    {
      situation: 'a full window',
      fiveHourFreeRatio: 1,
      hoursUntilFiveHourReset: 5,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 4,
    },
    {
      situation: 'a small share left that resets within the hour',
      fiveHourFreeRatio: 0.14,
      hoursUntilFiveHourReset: 0.8,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 3,
    },
    {
      situation:
        'a full window that resets in six minutes, capped at what a new full window carries',
      fiveHourFreeRatio: 1,
      hoursUntilFiveHourReset: 0.1,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 4,
    },
    {
      situation: 'a used-up window, never below one',
      fiveHourFreeRatio: 0,
      hoursUntilFiveHourReset: 3,
      fiveHourShareConsumedPerSessionHour: 0.05,
      expectedSessionCount: 1,
    },
    {
      situation: 'a full window at twice the consumption per session hour',
      fiveHourFreeRatio: 1,
      hoursUntilFiveHourReset: 5,
      fiveHourShareConsumedPerSessionHour: 0.1,
      expectedSessionCount: 2,
    },
  ])(
    'allows $expectedSessionCount session(s) for $situation',
    ({
      fiveHourFreeRatio,
      hoursUntilFiveHourReset,
      fiveHourShareConsumedPerSessionHour,
      expectedSessionCount,
    }) => {
      expect(
        fiveHourSustainableSessionCountOf(
          fiveHourFreeRatio,
          hoursUntilFiveHourReset,
          settingsWith({ fiveHourShareConsumedPerSessionHour }),
        ),
      ).toBe(expectedSessionCount);
    },
  );
});

describe('LiveSessionOauthTokenSelectUseCase five hour sustainable session limit', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it.each([
    {
      situation: '68% free with the five hour reset 4.6 hours away',
      tokenSnapshot: snapshot({
        fiveHourUtilization: 0.32,
        fiveHourReset: NOW + 4.6 * HOUR,
      }),
      expectedConcurrentSessionLimit: 2,
    },
    {
      situation: '27% free with the five hour reset 4.3 hours away',
      tokenSnapshot: snapshot({
        fiveHourUtilization: 0.73,
        fiveHourReset: NOW + 4.3 * HOUR,
      }),
      expectedConcurrentSessionLimit: 1,
    },
    {
      situation: 'no rate limit snapshot yet',
      tokenSnapshot: null,
      expectedConcurrentSessionLimit: 4,
    },
    {
      situation: 'a used-up five hour window whose reset has already passed',
      tokenSnapshot: snapshot({
        fiveHourUtilization: 1,
        fiveHourReset: NOW - 60,
      }),
      expectedConcurrentSessionLimit: 4,
    },
  ])(
    'limits a token with $situation to $expectedConcurrentSessionLimit concurrent session(s) under the default settings',
    ({ tokenSnapshot, expectedConcurrentSessionLimit }) => {
      const result = useCase.run(
        [candidate('measured', tokenSnapshot)],
        [],
        NOW,
        SETTINGS,
      );

      const measured = result.metrics.find((m) => m.name === 'measured');
      expect(measured?.concurrentSessionLimit).toBe(
        expectedConcurrentSessionLimit,
      );
    },
  );

  it('stops selecting the soonest resetting token once its live sessions use up what its five hour window sustains', () => {
    const result = useCase.run(
      [
        candidate(
          'soonResetTwoThirdsFree',
          snapshot({
            fiveHourUtilization: 0.32,
            fiveHourReset: NOW + 4.6 * HOUR,
            sevenDayReset: NOW + 2 * DAY,
          }),
        ),
        candidate(
          'distantResetFresh',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      [
        session('soonResetTwoThirdsFree', 'pid:201'),
        session('soonResetTwoThirdsFree', 'pid:202'),
      ],
      NOW,
      SETTINGS,
    );

    const soonReset = result.metrics.find(
      (m) => m.name === 'soonResetTwoThirdsFree',
    );
    expect(soonReset?.hasConcurrencyHeadroom).toBe(false);
    expect(result.selected?.name).toBe('distantResetFresh');
  });

  it('spreads an overflow to the token that is least over its limit when no eligible token has headroom', () => {
    const result = useCase.run(
      [
        candidate(
          'soonResetOneSessionLimit',
          snapshot({
            fiveHourUtilization: 0.73,
            fiveHourReset: NOW + 4.3 * HOUR,
            sevenDayReset: NOW + 2 * DAY,
          }),
        ),
        candidate(
          'distantResetFresh',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      [
        ...sessionsFor('soonResetOneSessionLimit', 1),
        ...sessionsFor('distantResetFresh', 5),
      ],
      NOW,
      settingsWith({ minFiveHourFreeRatio: 0.25 }),
    );

    const soonReset = result.metrics.find(
      (m) => m.name === 'soonResetOneSessionLimit',
    );
    const distantReset = result.metrics.find(
      (m) => m.name === 'distantResetFresh',
    );
    expect(soonReset?.concurrentSessionLimit).toBe(1);
    expect(distantReset?.concurrentSessionLimit).toBe(4);
    expect(result.selected?.name).toBe('distantResetFresh');
  });
});

describe('LiveSessionOauthTokenSelectUseCase drains the token with the least seven day budget first', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('selects a 2% free token inside the 48-hour deadline window first', () => {
    const result = useCase.run(
      [
        candidate('freshFirst', snapshot({})),
        candidate('halfSpent', snapshot({ sevenDayUtilization: 0.5 })),
        candidate(
          'nearlySpentInsideDeadline',
          snapshot({
            sevenDayUtilization: 0.98,
            sevenDayReset: NOW + 28 * HOUR,
          }),
        ),
        candidate('freshLast', snapshot({})),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const nearlySpent = result.metrics.find(
      (m) => m.name === 'nearlySpentInsideDeadline',
    );
    expect(nearlySpent?.eligible).toBe(true);
    expect(nearlySpent?.exclusionReason).toBeNull();
    expect(result.selected?.name).toBe('nearlySpentInsideDeadline');
  });

  it('selects a 7% free token before the deadline ahead of a 25% free token under fleet minimum free ratios of 10% and 25%', () => {
    const result = useCase.run(
      [
        candidate(
          'twentyFivePercentFree',
          snapshot({
            sevenDayUtilization: 0.75,
            sevenDayReset: NOW + 72 * HOUR,
          }),
        ),
        candidate(
          'sevenPercentFree',
          snapshot({
            sevenDayUtilization: 0.93,
            sevenDayReset: NOW + 6 * DAY,
          }),
        ),
      ],
      [],
      NOW,
      settingsWith({ minSevenDayFreeRatio: 0.1, minFiveHourFreeRatio: 0.25 }),
    );

    const sevenPercent = result.metrics.find(
      (m) => m.name === 'sevenPercentFree',
    );
    expect(sevenPercent?.eligible).toBe(true);
    expect(sevenPercent?.exclusionReason).toBeNull();
    expect(result.selected?.name).toBe('sevenPercentFree');
  });

  const rejectedCases: [string, boolean, boolean][] = [
    ['unified status rejected', true, false],
    ['fable weekly limit rejected', false, true],
  ];

  it.each(rejectedCases)(
    'keeps a token with the least seven day budget excluded when the API reports %s',
    (_description, unifiedRejected, fableRejected) => {
      const result = useCase.run(
        [
          candidate(
            'rejectedLeastBudget',
            snapshot({
              sevenDayUtilization: 0.98,
              sevenDayReset: NOW + 28 * HOUR,
            }),
            false,
            unifiedRejected,
            fableRejected,
          ),
          candidate(
            'sevenPercentFree',
            snapshot({
              sevenDayUtilization: 0.93,
              sevenDayReset: NOW + 5 * DAY,
            }),
          ),
          candidate('fresh', snapshot({})),
        ],
        [],
        NOW,
        SETTINGS,
      );

      const rejected = result.metrics.find(
        (m) => m.name === 'rejectedLeastBudget',
      );
      expect(rejected?.eligible).toBe(false);
      expect(rejected?.exclusionReason).toContain('rejected');
      expect(result.selected?.name).toBe('sevenPercentFree');
    },
  );

  const concurrencyCapCases: [number, string][] = [
    [0, 'leastBudget'],
    [9, 'leastBudget'],
    [10, 'moreBudget'],
  ];

  it.each(concurrencyCapCases)(
    'fills the least budget token up to its concurrent session limit of ten before moving to the next token (%i live sessions selects %s)',
    (leastBudgetLiveSessionCount, expectedSelectedName) => {
      const result = useCase.run(
        [
          candidate(
            'moreBudget',
            snapshot({
              sevenDayUtilization: 0.6,
              sevenDayReset: NOW + 5 * DAY,
            }),
          ),
          candidate(
            'leastBudget',
            snapshot({
              sevenDayUtilization: 0.9,
              sevenDayReset: NOW + 5 * DAY,
            }),
          ),
        ],
        sessionsFor('leastBudget', leastBudgetLiveSessionCount),
        NOW,
        settingsWith({ fiveHourShareConsumedPerSessionHour: 0.02 }),
      );

      const leastBudget = result.metrics.find((m) => m.name === 'leastBudget');
      expect(leastBudget?.concurrentSessionLimit).toBe(
        MAX_CONCURRENT_SESSION_COUNT,
      );
      expect(result.selected?.name).toBe(expectedSelectedName);
    },
  );

  it('moves a token whose remaining seven day budget cannot be spent by 48 hours before its reset at the maximum concurrency ahead of a token with less budget that can be spent', () => {
    const result = useCase.run(
      [
        candidate(
          'drainableSoonerReset',
          snapshot({
            sevenDayUtilization: 0.7,
            sevenDayReset: NOW + 72 * HOUR,
          }),
        ),
        candidate(
          'undrainableLaterReset',
          snapshot({
            sevenDayUtilization: 0,
            sevenDayReset: NOW + 80 * HOUR,
          }),
        ),
      ],
      [],
      NOW,
      SETTINGS,
    );

    const drainable = result.metrics.find(
      (m) => m.name === 'drainableSoonerReset',
    );
    const undrainable = result.metrics.find(
      (m) => m.name === 'undrainableLaterReset',
    );
    expect(drainable?.sevenDayBudgetUndrainableBeforeSpendDeadline).toBe(false);
    expect(undrainable?.sevenDayBudgetUndrainableBeforeSpendDeadline).toBe(
      true,
    );
    expect(result.selected?.name).toBe('undrainableLaterReset');
  });

  it('selects via fallback the token with the highest five hour free ratio when every token is blocked by an HTTP 401 auth failure', () => {
    const result = useCase.run(
      [
        {
          ...candidate(
            'authFailedNarrow',
            snapshot({ fiveHourUtilization: 0.8 }),
          ),
          blockedUntilEpoch: NOW + HOUR,
        },
        {
          ...candidate(
            'authFailedWide',
            snapshot({ fiveHourUtilization: 0.2 }),
          ),
          blockedUntilEpoch: NOW + HOUR,
        },
      ],
      [],
      NOW,
      SETTINGS,
    );

    const wide = result.metrics.find((m) => m.name === 'authFailedWide');
    expect(wide?.eligible).toBe(false);
    expect(wide?.exclusionReason).toContain('HTTP 401');
    expect(result.selected?.name).toBe('authFailedWide');
  });
});

describe('sevenDayShareDrainableBeforeSpendDeadlineOf', () => {
  const drainableShareCases: [
    string,
    number,
    LiveSessionOauthTokenSelectionSettings,
    number,
  ][] = [
    ['a reset inside the 48-hour deadline window', 28 * HOUR, SETTINGS, 0],
    ['a reset 72 hours away', 72 * HOUR, SETTINGS, 0.672],
    ['a reset seven days away', 7 * DAY, SETTINGS, 3.36],
    ['a reset already in the past', -HOUR, SETTINGS, 0],
    [
      'a reset seven days away when each session consumes only 0.1% of the five hour window per hour',
      7 * DAY,
      settingsWhereFiveHourSustainabilityNeverBindsWith({}),
      0.168,
    ],
  ];

  it.each(drainableShareCases)(
    'returns the seven day share the maximum concurrency can spend before the spend deadline for %s',
    (_description, secondsUntilSevenDayReset, settings, expectedShare) => {
      expect(
        sevenDayShareDrainableBeforeSpendDeadlineOf(
          NOW + secondsUntilSevenDayReset,
          NOW,
          settings,
        ),
      ).toBeCloseTo(expectedShare, 10);
    },
  );
});

describe('sevenDayBudgetUndrainableBeforeSpendDeadlineOf', () => {
  const undrainableCases: [number, number, boolean][] = [
    [0.02, 28 * HOUR, true],
    [0, 28 * HOUR, false],
    [0.5, 72 * HOUR, false],
    [0.7, 72 * HOUR, true],
    [1, 80 * HOUR, true],
    [1, 7 * DAY, false],
  ];

  it.each(undrainableCases)(
    'reports %f seven day free with the reset %i seconds away as undrainable: %s',
    (sevenDayFreeRatio, secondsUntilSevenDayReset, expectedUndrainable) => {
      expect(
        sevenDayBudgetUndrainableBeforeSpendDeadlineOf(
          sevenDayFreeRatio,
          NOW + secondsUntilSevenDayReset,
          NOW,
          SETTINGS,
        ),
      ).toBe(expectedUndrainable);
    },
  );
});

describe('liveSessionOauthTokenCandidateMetricsInSelectionOrder', () => {
  const metricOf = (
    name: string,
    overrides: Partial<LiveSessionOauthTokenCandidateMetrics>,
  ): LiveSessionOauthTokenCandidateMetrics => ({
    name,
    fiveHourFreeRatio: 1,
    sevenDayFreeRatio: 1,
    sevenDayEndEpoch: NOW + 7 * DAY,
    sevenDayBudgetUndrainableBeforeSpendDeadline: false,
    liveSessionCount: 0,
    concurrentSessionLimit: MAX_CONCURRENT_SESSION_COUNT,
    hasConcurrencyHeadroom: true,
    eligible: true,
    exclusionReason: null,
    selectionWeight: 1,
    ...overrides,
  });

  const selectionOrderCases: [
    string,
    LiveSessionOauthTokenCandidateMetrics[],
    string[],
  ][] = [
    [
      'puts a token whose seven day budget is undrainable first even when it has more budget',
      [
        metricOf('leastBudget', { sevenDayFreeRatio: 0.1 }),
        metricOf('undrainable', {
          sevenDayFreeRatio: 0.9,
          sevenDayBudgetUndrainableBeforeSpendDeadline: true,
        }),
      ],
      ['undrainable', 'leastBudget'],
    ],
    [
      'orders by seven day free ratio ascending',
      [
        metricOf('half', { sevenDayFreeRatio: 0.5 }),
        metricOf('full', { sevenDayFreeRatio: 1 }),
        metricOf('tenth', { sevenDayFreeRatio: 0.1 }),
      ],
      ['tenth', 'half', 'full'],
    ],
    [
      'orders undrainable tokens by seven day free ratio ascending among themselves',
      [
        metricOf('undrainableFull', {
          sevenDayFreeRatio: 1,
          sevenDayBudgetUndrainableBeforeSpendDeadline: true,
        }),
        metricOf('undrainableHalf', {
          sevenDayFreeRatio: 0.5,
          sevenDayBudgetUndrainableBeforeSpendDeadline: true,
        }),
      ],
      ['undrainableHalf', 'undrainableFull'],
    ],
    [
      'breaks a seven day free ratio tie by the sooner seven day reset',
      [
        metricOf('laterReset', { sevenDayEndEpoch: NOW + 6 * DAY }),
        metricOf('soonerReset', { sevenDayEndEpoch: NOW + 5 * DAY }),
      ],
      ['soonerReset', 'laterReset'],
    ],
    [
      'breaks a seven day free ratio and reset tie by the fewer live sessions',
      [
        metricOf('busy', { liveSessionCount: 3 }),
        metricOf('idle', { liveSessionCount: 0 }),
      ],
      ['idle', 'busy'],
    ],
    [
      'keeps the candidate order for a full tie',
      [metricOf('first', {}), metricOf('second', {})],
      ['first', 'second'],
    ],
  ];

  it.each(selectionOrderCases)(
    '%s',
    (_description, metrics, expectedNamesInSelectionOrder) => {
      expect(
        liveSessionOauthTokenCandidateMetricsInSelectionOrder(metrics).map(
          (metric) => metric.name,
        ),
      ).toEqual(expectedNamesInSelectionOrder);
    },
  );

  it('does not reorder the metrics array it is given', () => {
    const metrics = [
      metricOf('full', { sevenDayFreeRatio: 1 }),
      metricOf('tenth', { sevenDayFreeRatio: 0.1 }),
    ];

    liveSessionOauthTokenCandidateMetricsInSelectionOrder(metrics);

    expect(metrics.map((metric) => metric.name)).toEqual(['full', 'tenth']);
  });
});
