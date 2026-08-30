import { computeProjectTimerState } from './projectTimer';

describe('computeProjectTimerState', () => {
  it('returns null when timerEndsAt is null', () => {
    expect(computeProjectTimerState(null, 1800, Date.now())).toBeNull();
  });

  it('returns null when timerTotalSeconds is null', () => {
    expect(
      computeProjectTimerState('2026-08-30T10:30:00.000Z', null, Date.now()),
    ).toBeNull();
  });

  it('returns null when both are null', () => {
    expect(computeProjectTimerState(null, null, Date.now())).toBeNull();
  });

  it('returns remaining seconds and progressRatio=1 when no time has elapsed', () => {
    const endsAt = '2026-08-30T10:30:00.000Z';
    const endsAtMs = new Date(endsAt).getTime();
    const nowMs = endsAtMs - 1800 * 1000;
    const state = computeProjectTimerState(endsAt, 1800, nowMs);
    expect(state).not.toBeNull();
    expect(state!.remainingSeconds).toBe(1800);
    expect(state!.progressRatio).toBe(1);
    expect(state!.totalSeconds).toBe(1800);
  });

  it('returns half remaining seconds and progressRatio=0.5 at midpoint', () => {
    const endsAt = '2026-08-30T10:30:00.000Z';
    const endsAtMs = new Date(endsAt).getTime();
    const nowMs = endsAtMs - 900 * 1000;
    const state = computeProjectTimerState(endsAt, 1800, nowMs);
    expect(state).not.toBeNull();
    expect(state!.remainingSeconds).toBe(900);
    expect(state!.progressRatio).toBeCloseTo(0.5, 5);
    expect(state!.totalSeconds).toBe(1800);
  });

  it('returns remainingSeconds=0 and progressRatio=0 when timer has expired', () => {
    const endsAt = '2026-08-30T10:30:00.000Z';
    const endsAtMs = new Date(endsAt).getTime();
    const nowMs = endsAtMs + 5000;
    const state = computeProjectTimerState(endsAt, 1800, nowMs);
    expect(state).not.toBeNull();
    expect(state!.remainingSeconds).toBe(0);
    expect(state!.progressRatio).toBe(0);
    expect(state!.totalSeconds).toBe(1800);
  });

  it('returns progressRatio clamped to 0 when far past expiry', () => {
    const endsAt = '2026-08-30T10:30:00.000Z';
    const endsAtMs = new Date(endsAt).getTime();
    const nowMs = endsAtMs + 3600 * 1000;
    const state = computeProjectTimerState(endsAt, 1800, nowMs);
    expect(state).not.toBeNull();
    expect(state!.progressRatio).toBe(0);
  });
});
