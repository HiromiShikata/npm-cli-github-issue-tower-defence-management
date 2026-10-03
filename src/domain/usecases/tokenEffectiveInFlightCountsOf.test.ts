import { tokenEffectiveInFlightCountsOf } from './tokenEffectiveInFlightCountsOf';

describe('tokenEffectiveInFlightCountsOf', () => {
  it.each<{
    label: string;
    realInFlightCounts: Record<string, number>;
    pendingReservationCounts: Record<string, number>;
    tokens: string[];
    expected: Record<string, number>;
  }>([
    {
      label: 'sums zero real and zero pending for a single token',
      realInFlightCounts: { A: 0 },
      pendingReservationCounts: { A: 0 },
      tokens: ['A'],
      expected: { A: 0 },
    },
    {
      label:
        'keeps the real in-flight count unchanged when there is no pending reservation',
      realInFlightCounts: { A: 2 },
      pendingReservationCounts: { A: 0 },
      tokens: ['A'],
      expected: { A: 2 },
    },
    {
      label:
        'counts a pending reservation when there is no real in-flight worker yet',
      realInFlightCounts: { A: 0 },
      pendingReservationCounts: { A: 1 },
      tokens: ['A'],
      expected: { A: 1 },
    },
    {
      label:
        'sums a real in-flight worker and a pending reservation for the same token',
      realInFlightCounts: { A: 1 },
      pendingReservationCounts: { A: 1 },
      tokens: ['A'],
      expected: { A: 2 },
    },
    {
      label:
        'treats a token missing from pendingReservationCounts as zero pending',
      realInFlightCounts: { A: 2 },
      pendingReservationCounts: {},
      tokens: ['A'],
      expected: { A: 2 },
    },
    {
      label:
        'treats a token missing from realInFlightCounts as zero real in-flight',
      realInFlightCounts: {},
      pendingReservationCounts: { A: 3 },
      tokens: ['A'],
      expected: { A: 3 },
    },
    {
      label: 'returns zero for a token missing from both inputs',
      realInFlightCounts: {},
      pendingReservationCounts: {},
      tokens: ['A'],
      expected: { A: 0 },
    },
    {
      label: 'computes each requested token independently in a single call',
      realInFlightCounts: { A: 1, B: 2 },
      pendingReservationCounts: { A: 1, B: 0 },
      tokens: ['A', 'B'],
      expected: { A: 2, B: 2 },
    },
  ])(
    '$label',
    ({ realInFlightCounts, pendingReservationCounts, tokens, expected }) => {
      const result = tokenEffectiveInFlightCountsOf(
        realInFlightCounts,
        pendingReservationCounts,
        tokens,
      );
      expect(result).toEqual(expected);
    },
  );
});
