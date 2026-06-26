import { ClaudeLiveSession } from './adapter-interfaces/ClaudeLiveSessionRepository';
import { LiveSessionOauthTokenSelectUseCase } from './LiveSessionOauthTokenSelectUseCase';
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
): OauthTokenCandidate => ({
  name,
  token: `fake-token-${name}`,
  snapshot: snapshotValue,
});

const session = (name: string, sessionKey: string): ClaudeLiveSession => ({
  token: `fake-token-${name}`,
  sessionKey,
});

describe('LiveSessionOauthTokenSelectUseCase', () => {
  const useCase = new LiveSessionOauthTokenSelectUseCase();

  it('prefers the eligible token with zero live sessions', () => {
    const result = useCase.run(
      [candidate('busy', snapshot({})), candidate('idle', snapshot({}))],
      [session('busy', 'session-a')],
      NOW,
    );

    expect(result.selected?.name).toBe('idle');
    expect(result.selected?.token).toBe('fake-token-idle');
    const idle = result.metrics.find((m) => m.name === 'idle');
    expect(idle?.liveSessionCount).toBe(0);
  });

  it('breaks an occupancy tie by the soonest 7d reset', () => {
    const result = useCase.run(
      [
        candidate('far', snapshot({ sevenDayReset: NOW + 6 * DAY })),
        candidate('soon', snapshot({ sevenDayReset: NOW + 2 * DAY })),
      ],
      [session('far', 'session-a'), session('soon', 'session-b')],
      NOW,
    );

    expect(result.selected?.name).toBe('soon');
  });

  it('prefers fewer live sessions over a sooner 7d reset', () => {
    const result = useCase.run(
      [
        candidate('soonButBusy', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        candidate('farButIdle', snapshot({ sevenDayReset: NOW + 6 * DAY })),
      ],
      [
        session('soonButBusy', 'session-a'),
        session('soonButBusy', 'session-b'),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('farButIdle');
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

    expect(result.selected?.name).toBe('fresh');
    const resumedHeavy = result.metrics.find((m) => m.name === 'resumedHeavy');
    const fresh = result.metrics.find((m) => m.name === 'fresh');
    expect(resumedHeavy?.liveSessionCount).toBe(2);
    expect(fresh?.liveSessionCount).toBe(1);
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
});
