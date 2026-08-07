import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import {
  LIVE_SESSION_MAX_CONCURRENT_LIMIT,
  LIVE_SESSION_THROTTLE_START_FREE_RATIO,
  LiveSessionOauthTokenSelectUseCase,
  liveSessionConcurrentLimitOf,
} from './LiveSessionOauthTokenSelectUseCase';
import {
  OauthTokenCandidate,
  OauthTokenWindowSnapshot,
} from './OauthTokenSelectUseCase';

const NOW = 1_000_000;
const HOUR = 3600;
const DAY = 86400;

const snapshot = (
  overrides: Partial<OauthTokenWindowSnapshot>,
): OauthTokenWindowSnapshot => ({
  fiveHourUtilization: 0,
  fiveHourReset: NOW + HOUR,
  sevenDayUtilization: 0,
  sevenDayReset: NOW + DAY,
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
      sessionsFor('soonResetBusy', 2),
      NOW,
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
      sessionsFor('soonReset', LIVE_SESSION_MAX_CONCURRENT_LIMIT - 1),
      NOW,
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
      sessionsFor('soonResetFull', LIVE_SESSION_MAX_CONCURRENT_LIMIT),
      NOW,
    );

    expect(result.selected?.name).toBe('distantResetIdle');
    const full = result.metrics.find((m) => m.name === 'soonResetFull');
    expect(full?.hasConcurrencyHeadroom).toBe(false);
    expect(full?.concurrentSessionLimit).toBe(
      LIVE_SESSION_MAX_CONCURRENT_LIMIT,
    );
  });

  it('lowers the concurrent session limit as the five hour window fills', () => {
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
      sessionsFor('soonResetNarrowFiveHour', 2),
      NOW,
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'soonResetNarrowFiveHour',
    );
    expect(narrow?.concurrentSessionLimit).toBe(2);
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('lowers the concurrent session limit as the seven day window fills', () => {
    const result = useCase.run(
      [
        candidate(
          'soonResetNarrowSevenDay',
          snapshot({
            sevenDayReset: NOW + 2 * HOUR,
            sevenDayUtilization: 0.7,
          }),
        ),
        candidate(
          'distantResetIdle',
          snapshot({ sevenDayReset: NOW + 6 * DAY }),
        ),
      ],
      sessionsFor('soonResetNarrowSevenDay', 2),
      NOW,
    );

    const narrow = result.metrics.find(
      (m) => m.name === 'soonResetNarrowSevenDay',
    );
    expect(narrow?.concurrentSessionLimit).toBe(2);
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
      sessionsFor('downWeighted', 2),
      NOW,
    );

    const downWeighted = result.metrics.find((m) => m.name === 'downWeighted');
    expect(downWeighted?.concurrentSessionLimit).toBe(2);
    expect(result.selected?.name).toBe('distantResetIdle');
  });

  it('never starves a sole eligible token whose selection weight rounds its limit below one', () => {
    const result = useCase.run(
      [
        withSelectionWeight(candidate('tinyWeight', snapshot({})), 0.01),
        candidate('blocked', snapshot({ fiveHourUtilization: 0.9 })),
      ],
      [],
      NOW,
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
        ...sessionsFor('distantResetFull', LIVE_SESSION_MAX_CONCURRENT_LIMIT),
        ...sessionsFor('soonResetFull', LIVE_SESSION_MAX_CONCURRENT_LIMIT),
      ],
      NOW,
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
    );

    expect(result.selected?.name).toBe('sameResetIdle');
  });

  it('returns the same token on repeated calls with the same inputs', () => {
    const candidates = [
      candidate('firstOfEqualPair', snapshot({})),
      candidate('secondOfEqualPair', snapshot({})),
    ];

    const first = useCase.run(candidates, [], NOW);
    const second = useCase.run(candidates, [], NOW);

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
    );

    expect(result.selected).toBeNull();
  });

  it('returns null selection for an empty candidate list', () => {
    const result = useCase.run([], [], NOW);

    expect(result.selected).toBeNull();
    expect(result.metrics).toEqual([]);
  });

  it('reports a zero live session count for tokens with no matching process', () => {
    const result = useCase.run(
      [candidate('lonely', snapshot({}))],
      [session('other', 'session-x')],
      NOW,
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
    );

    expect(result.selected?.name).toBe('active');
    const rejected = result.metrics.find((m) => m.name === 'rejected');
    expect(rejected?.eligible).toBe(false);
    expect(rejected?.exclusionReason).toContain('rejected');
  });
});

describe('liveSessionConcurrentLimitOf', () => {
  it('gives the full limit while both windows are above the taper threshold', () => {
    expect(liveSessionConcurrentLimitOf(1, 1, 1)).toBe(
      LIVE_SESSION_MAX_CONCURRENT_LIMIT,
    );
    expect(
      liveSessionConcurrentLimitOf(
        LIVE_SESSION_THROTTLE_START_FREE_RATIO,
        LIVE_SESSION_THROTTLE_START_FREE_RATIO,
        1,
      ),
    ).toBe(LIVE_SESSION_MAX_CONCURRENT_LIMIT);
  });

  it('takes the lower limit of the two windows', () => {
    expect(liveSessionConcurrentLimitOf(1, 0.3, 1)).toBe(2);
    expect(liveSessionConcurrentLimitOf(0.3, 1, 1)).toBe(2);
  });

  it('never returns less than one even when a window is fully used', () => {
    expect(liveSessionConcurrentLimitOf(0, 0, 1)).toBe(1);
    expect(liveSessionConcurrentLimitOf(1, 1, 0)).toBe(1);
  });

  it('raises the limit for a weight above one', () => {
    expect(liveSessionConcurrentLimitOf(1, 1, 1.5)).toBe(6);
  });
});
