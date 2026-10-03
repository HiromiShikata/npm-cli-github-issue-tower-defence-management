import {
  TOKEN_LAUNCH_RESERVATION_TTL_MS,
  tokenLaunchReservationIsStillPendingOf,
} from './tokenLaunchReservationIsStillPendingOf';

describe('tokenLaunchReservationIsStillPendingOf', () => {
  const nowMs = 1_700_000_000_000;

  it.each<{
    label: string;
    elapsedMs: number;
    reservationBecameLiveWorker: boolean;
    expected: boolean;
  }>([
    {
      label:
        'returns true when the reservation was made just now and has not become a live worker',
      elapsedMs: 0,
      reservationBecameLiveWorker: false,
      expected: true,
    },
    {
      label: 'returns true one millisecond before the TTL expires',
      elapsedMs: TOKEN_LAUNCH_RESERVATION_TTL_MS - 1,
      reservationBecameLiveWorker: false,
      expected: true,
    },
    {
      label:
        'returns true exactly at the TTL boundary because the comparison is strict greater-than',
      elapsedMs: TOKEN_LAUNCH_RESERVATION_TTL_MS,
      reservationBecameLiveWorker: false,
      expected: true,
    },
    {
      label: 'returns false one millisecond past the TTL',
      elapsedMs: TOKEN_LAUNCH_RESERVATION_TTL_MS + 1,
      reservationBecameLiveWorker: false,
      expected: false,
    },
    {
      label:
        'returns false when the reservation already became a live worker even though it is fresh',
      elapsedMs: 0,
      reservationBecameLiveWorker: true,
      expected: false,
    },
    {
      label:
        'returns false when the reservation is both expired and already a live worker',
      elapsedMs: TOKEN_LAUNCH_RESERVATION_TTL_MS + 1,
      reservationBecameLiveWorker: true,
      expected: false,
    },
  ])('$label', ({ elapsedMs, reservationBecameLiveWorker, expected }) => {
    const result = tokenLaunchReservationIsStillPendingOf(
      { reservedAt: nowMs - elapsedMs },
      nowMs,
      reservationBecameLiveWorker,
    );
    expect(result).toBe(expected);
  });
});

describe('TOKEN_LAUNCH_RESERVATION_TTL_MS', () => {
  it('is set to 600000 milliseconds (10 minutes), long enough to survive the 420 second launcher hold bound', () => {
    expect(TOKEN_LAUNCH_RESERVATION_TTL_MS).toBe(600_000);
  });
});
