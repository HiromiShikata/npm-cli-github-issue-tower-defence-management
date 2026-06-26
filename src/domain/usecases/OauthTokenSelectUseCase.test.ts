import {
  OauthTokenCandidate,
  OauthTokenSelectUseCase,
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

describe('OauthTokenSelectUseCase', () => {
  const useCase = new OauthTokenSelectUseCase();

  it('selects the eligible token whose 7d window resets soonest', () => {
    const result = useCase.run(
      [
        candidate(
          'far',
          snapshot({ sevenDayUtilization: 0.1, sevenDayReset: NOW + 6 * DAY }),
        ),
        candidate(
          'soon',
          snapshot({ sevenDayUtilization: 0.1, sevenDayReset: NOW + 2 * DAY }),
        ),
        candidate(
          'middle',
          snapshot({ sevenDayUtilization: 0.1, sevenDayReset: NOW + 4 * DAY }),
        ),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('soon');
    expect(result.selected?.token).toBe('fake-token-soon');
  });

  it('excludes a token whose 5h window is less than 60% free', () => {
    const result = useCase.run(
      [
        candidate('busy5h', snapshot({ fiveHourUtilization: 0.41 })),
        candidate('ok', snapshot({ fiveHourUtilization: 0.4 })),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy5h');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('5h window');
  });

  it('treats exactly 40% used 5h utilization as eligible (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ fiveHourUtilization: 0.4 }))],
      NOW,
    );

    expect(result.selected?.name).toBe('boundary');
  });

  it('excludes a token whose 7d window is less than 7% free', () => {
    const result = useCase.run(
      [
        candidate('busy7d', snapshot({ sevenDayUtilization: 0.94 })),
        candidate('ok', snapshot({ sevenDayUtilization: 0.92 })),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy7d');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('7d window');
  });

  it('treats a 7d window with at least 7% free as eligible (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ sevenDayUtilization: 0.92 }))],
      NOW,
    );

    expect(result.selected?.name).toBe('boundary');
  });

  it('treats a token with no snapshot as fully free', () => {
    const result = useCase.run([candidate('fresh', null)], NOW);

    expect(result.selected?.name).toBe('fresh');
    const fresh = result.metrics.find((m) => m.name === 'fresh');
    expect(fresh?.fiveHourFreeRatio).toBe(1);
    expect(fresh?.sevenDayFreeRatio).toBe(1);
  });

  it('treats an expired window as fully free', () => {
    const result = useCase.run(
      [
        candidate(
          'expired',
          snapshot({
            fiveHourUtilization: 0.99,
            fiveHourReset: NOW - HOUR,
            sevenDayUtilization: 0.99,
            sevenDayReset: NOW - DAY,
          }),
        ),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('expired');
    const expired = result.metrics.find((m) => m.name === 'expired');
    expect(expired?.fiveHourFreeRatio).toBe(1);
    expect(expired?.sevenDayFreeRatio).toBe(1);
  });

  it('treats a token with no active 7d window as having the farthest 7d end', () => {
    const result = useCase.run(
      [
        candidate(
          'noSevenDay',
          snapshot({ sevenDayReset: 0, sevenDayUtilization: 0 }),
        ),
        candidate(
          'activeSoon',
          snapshot({
            sevenDayUtilization: 0.1,
            sevenDayReset: NOW + 3 * DAY,
          }),
        ),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('activeSoon');
    const noSevenDay = result.metrics.find((m) => m.name === 'noSevenDay');
    expect(noSevenDay?.sevenDayEndEpoch).toBe(NOW + 7 * DAY);
  });

  it('returns null selection when no token passes the filter', () => {
    const result = useCase.run(
      [
        candidate('busy', snapshot({ fiveHourUtilization: 0.9 })),
        candidate('alsoBusy', snapshot({ sevenDayUtilization: 0.95 })),
      ],
      NOW,
    );

    expect(result.selected).toBeNull();
  });

  it('returns null selection for an empty candidate list', () => {
    const result = useCase.run([], NOW);

    expect(result.selected).toBeNull();
    expect(result.metrics).toEqual([]);
  });

  it('reports per-candidate metrics for every input token', () => {
    const result = useCase.run(
      [
        candidate('a', snapshot({ fiveHourUtilization: 0.2 })),
        candidate('b', snapshot({ fiveHourUtilization: 0.95 })),
      ],
      NOW,
    );

    expect(result.metrics.map((m) => m.name)).toEqual(['a', 'b']);
  });
});
