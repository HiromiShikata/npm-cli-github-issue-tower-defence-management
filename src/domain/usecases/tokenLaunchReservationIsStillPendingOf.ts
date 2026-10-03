export const TOKEN_LAUNCH_RESERVATION_TTL_MS = 600_000;

export const tokenLaunchReservationIsStillPendingOf = (
  reservation: { reservedAt: number },
  nowMs: number,
  reservationBecameLiveWorker: boolean,
): boolean =>
  nowMs - reservation.reservedAt <= TOKEN_LAUNCH_RESERVATION_TTL_MS &&
  !reservationBecameLiveWorker;
