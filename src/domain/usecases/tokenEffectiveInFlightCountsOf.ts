export const tokenEffectiveInFlightCountsOf = (
  realInFlightCounts: Record<string, number>,
  pendingReservationCounts: Record<string, number>,
  tokens: string[],
): Record<string, number> =>
  Object.fromEntries(
    tokens.map((token) => [
      token,
      (realInFlightCounts[token] ?? 0) +
        (pendingReservationCounts[token] ?? 0),
    ]),
  );
