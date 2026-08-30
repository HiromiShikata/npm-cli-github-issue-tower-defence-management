import {
  CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
  OauthTokenCandidate,
  OauthTokenSelectUseCase,
  OauthTokenWindowSnapshot,
  SEVEN_DAY_WINDOW_HOURS,
  sevenDayUrgencyFactor,
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
      () => 0.5,
    );

    expect(result.selected?.name).toBe('soon');
    expect(result.selected?.token).toBe('fake-token-soon');
  });

  it('excludes a token whose 5h window is less than 25% free', () => {
    const result = useCase.run(
      [
        candidate('busy5h', snapshot({ fiveHourUtilization: 0.76 })),
        candidate('ok', snapshot({ fiveHourUtilization: 0.75 })),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy5h');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('5h window');
  });

  it('treats exactly 75% used 5h utilization as eligible (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ fiveHourUtilization: 0.75 }))],
      NOW,
    );

    expect(result.selected?.name).toBe('boundary');
    const boundary = result.metrics.find((m) => m.name === 'boundary');
    expect(boundary?.fiveHourFreeRatio).toBe(0.25);
  });

  it('does not exclude a token with 2% of its seven day budget remaining', () => {
    const result = useCase.run(
      [candidate('nearFull', snapshot({ sevenDayUtilization: 0.98 }))],
      NOW,
    );

    expect(result.selected?.name).toBe('nearFull');
    const nearFull = result.metrics.find((m) => m.name === 'nearFull');
    expect(nearFull?.eligible).toBe(true);
  });

  it('excludes a token whose 7d window is less than 1% free', () => {
    const result = useCase.run(
      [
        candidate('busy7d', snapshot({ sevenDayUtilization: 0.995 })),
        candidate('ok', snapshot({ sevenDayUtilization: 0.99 })),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy7d');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('7d window');
  });

  it('treats exactly 99% used 7d utilization as eligible (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ sevenDayUtilization: 0.99 }))],
      NOW,
    );

    expect(result.selected?.name).toBe('boundary');
    const boundary = result.metrics.find((m) => m.name === 'boundary');
    expect(boundary?.sevenDayFreeRatio).toBeCloseTo(0.01, 9);
  });

  it('proceeds when 5h is exactly 25% free and 7d is exactly 1% free (combined boundary)', () => {
    const result = useCase.run(
      [
        candidate(
          'boundary',
          snapshot({ fiveHourUtilization: 0.75, sevenDayUtilization: 0.99 }),
        ),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('boundary');
    const boundary = result.metrics.find((m) => m.name === 'boundary');
    expect(boundary?.eligible).toBe(true);
    expect(boundary?.fiveHourFreeRatio).toBe(0.25);
    expect(boundary?.sevenDayFreeRatio).toBeCloseTo(0.01, 9);
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
      () => 0.5,
    );

    expect(result.selected?.name).toBe('activeSoon');
    const noSevenDay = result.metrics.find((m) => m.name === 'noSevenDay');
    expect(noSevenDay?.sevenDayEndEpoch).toBe(NOW + 7 * DAY);
  });

  it('returns null selection when no token passes the filter', () => {
    const result = useCase.run(
      [
        candidate('busy', snapshot({ fiveHourUtilization: 0.9 })),
        candidate('alsoBusy', snapshot({ sevenDayUtilization: 0.995 })),
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

  it('excludes a subscription-disabled token even when rate-limit windows are fully free', () => {
    const result = useCase.run(
      [
        candidate('disabled', snapshot({}), true),
        candidate('active', snapshot({}), false),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('active');
    const disabled = result.metrics.find((m) => m.name === 'disabled');
    expect(disabled?.eligible).toBe(false);
    expect(disabled?.exclusionReason).toContain(
      'organization has disabled Claude subscription access for Claude Code',
    );
  });

  it('excludes a unified-rejected token even when rate-limit windows are fully free', () => {
    const result = useCase.run(
      [
        candidate('rejected', snapshot({}), false, true),
        candidate('active', snapshot({}), false, false),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('active');
    const rejected = result.metrics.find((m) => m.name === 'rejected');
    expect(rejected?.eligible).toBe(false);
    expect(rejected?.exclusionReason).toContain('rejected');
  });

  it('excludes a fable-rejected token even when rate-limit windows are fully free', () => {
    const result = useCase.run(
      [
        candidate('fable-out', snapshot({}), false, false, true),
        candidate('active', snapshot({}), false, false, false),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('active');
    const fableOut = result.metrics.find((m) => m.name === 'fable-out');
    expect(fableOut?.eligible).toBe(false);
    expect(fableOut?.exclusionReason).toContain('fable weekly limit exhausted');
  });

  it('treats a token without a fable marker as eligible for fable selection', () => {
    const result = useCase.run([candidate('alive', snapshot({}))], NOW);

    expect(result.selected?.name).toBe('alive');
    const alive = result.metrics.find((m) => m.name === 'alive');
    expect(alive?.eligible).toBe(true);
  });
});

const sweepingRandom = (count: number): (() => number) => {
  let index = 0;
  return () => {
    const value = (index + 0.5) / count;
    index += 1;
    return value;
  };
};

const throwingRandom = (): number => {
  throw new Error('random source must not be consulted');
};

const withSelectionWeight = (
  base: OauthTokenCandidate,
  selectionWeight: number,
): OauthTokenCandidate => ({ ...base, selectionWeight });

describe('OauthTokenSelectUseCase selectionWeight', () => {
  const useCase = new OauthTokenSelectUseCase();

  it('keeps the deterministic selection and never consults random when the urgency weights are identical', () => {
    const result = useCase.run(
      [
        candidate(
          'firstOfEqualPair',
          snapshot({ sevenDayUtilization: 0.1, sevenDayReset: NOW + 2 * DAY }),
        ),
        candidate(
          'secondOfEqualPair',
          snapshot({ sevenDayUtilization: 0.1, sevenDayReset: NOW + 2 * DAY }),
        ),
      ],
      NOW,
      throwingRandom,
    );

    expect(result.selected?.name).toBe('firstOfEqualPair');
  });

  it('treats an absent selectionWeight the same as weight 1 (uniform, deterministic)', () => {
    const result = useCase.run(
      [
        withSelectionWeight(
          candidate(
            'explicitWeightOne',
            snapshot({ sevenDayReset: NOW + 2 * DAY }),
          ),
          1,
        ),
        candidate('absentWeight', snapshot({ sevenDayReset: NOW + 2 * DAY })),
      ],
      NOW,
      throwingRandom,
    );

    expect(result.selected?.name).toBe('explicitWeightOne');
  });

  it('selects a sole eligible low-weight token without consulting random (no starvation)', () => {
    const result = useCase.run(
      [
        withSelectionWeight(candidate('lowWeightOnly', snapshot({})), 0.01),
        candidate('blocked', snapshot({ fiveHourUtilization: 0.9 })),
      ],
      NOW,
      throwingRandom,
    );

    expect(result.selected?.name).toBe('lowWeightOnly');
  });

  it('chooses a lower-weight token proportionally less often among eligible candidates', () => {
    const count = 1000;
    const random = sweepingRandom(count);
    const selectionCounts = new Map<string, number>();

    for (let i = 0; i < count; i += 1) {
      const result = useCase.run(
        [
          withSelectionWeight(candidate('heavy', snapshot({})), 1),
          withSelectionWeight(candidate('light', snapshot({})), 0.5),
        ],
        NOW,
        random,
      );
      const name = result.selected?.name ?? 'none';
      selectionCounts.set(name, (selectionCounts.get(name) ?? 0) + 1);
    }

    const heavy = selectionCounts.get('heavy') ?? 0;
    const light = selectionCounts.get('light') ?? 0;
    expect(heavy + light).toBe(count);
    expect(light).toBeGreaterThan(0);
    expect(light).toBeLessThan(heavy);
    expect(Math.abs(light / count - 1 / 3)).toBeLessThan(0.02);
    expect(Math.abs(heavy / count - 2 / 3)).toBeLessThan(0.02);
  });

  it('chooses a higher-weight token more often among eligible candidates', () => {
    const count = 1000;
    const random = sweepingRandom(count);
    const selectionCounts = new Map<string, number>();

    for (let i = 0; i < count; i += 1) {
      const result = useCase.run(
        [
          withSelectionWeight(candidate('double', snapshot({})), 2),
          withSelectionWeight(candidate('single', snapshot({})), 1),
        ],
        NOW,
        random,
      );
      const name = result.selected?.name ?? 'none';
      selectionCounts.set(name, (selectionCounts.get(name) ?? 0) + 1);
    }

    const double = selectionCounts.get('double') ?? 0;
    const single = selectionCounts.get('single') ?? 0;
    expect(double).toBeGreaterThan(single);
    expect(single).toBeGreaterThan(0);
  });

  it('gives a zero-weight token no chance while other eligible tokens exist', () => {
    const count = 100;
    const random = sweepingRandom(count);
    const selectionCounts = new Map<string, number>();

    for (let i = 0; i < count; i += 1) {
      const result = useCase.run(
        [
          withSelectionWeight(candidate('zero', snapshot({})), 0),
          withSelectionWeight(candidate('positive', snapshot({})), 1),
        ],
        NOW,
        random,
      );
      const name = result.selected?.name ?? 'none';
      selectionCounts.set(name, (selectionCounts.get(name) ?? 0) + 1);
    }

    expect(selectionCounts.get('zero') ?? 0).toBe(0);
    expect(selectionCounts.get('positive') ?? 0).toBe(count);
  });

  it('falls back to the deterministic best when every eligible weight is zero', () => {
    const result = useCase.run(
      [
        withSelectionWeight(
          candidate('far', snapshot({ sevenDayReset: NOW + 6 * DAY })),
          0,
        ),
        withSelectionWeight(
          candidate('soon', snapshot({ sevenDayReset: NOW + 2 * DAY })),
          0,
        ),
      ],
      NOW,
      throwingRandom,
    );

    expect(result.selected?.name).toBe('soon');
  });
});

describe('OauthTokenCandidateMetrics drawWeight', () => {
  const useCase = new OauthTokenSelectUseCase();

  it('reports draw weight zero for an ineligible candidate', () => {
    const result = useCase.run(
      [
        candidate('busy5h', snapshot({ fiveHourUtilization: 0.9 })),
        candidate('ok', snapshot({})),
      ],
      NOW,
    );

    const busy = result.metrics.find((m) => m.name === 'busy5h');
    expect(busy?.drawWeight).toBe(0);
  });

  it('reports a positive draw weight for an eligible candidate', () => {
    const result = useCase.run(
      [candidate('eligible', snapshot({ sevenDayReset: NOW + 2 * DAY }))],
      NOW,
    );

    const eligible = result.metrics.find((m) => m.name === 'eligible');
    expect(eligible?.drawWeight).toBeGreaterThan(0);
  });

  it('gives a higher draw weight to a candidate whose 7d window resets sooner', () => {
    const result = useCase.run(
      [
        candidate('soon', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        candidate('far', snapshot({ sevenDayReset: NOW + 6 * DAY })),
      ],
      NOW,
    );

    const soon = result.metrics.find((m) => m.name === 'soon');
    const far = result.metrics.find((m) => m.name === 'far');
    expect(soon?.drawWeight ?? 0).toBeGreaterThan(far?.drawWeight ?? 0);
  });

  it('scales draw weight by the configured selection weight', () => {
    const result = useCase.run(
      [
        withSelectionWeight(
          candidate('double', snapshot({ sevenDayReset: NOW + 2 * DAY })),
          2,
        ),
        withSelectionWeight(
          candidate('single', snapshot({ sevenDayReset: NOW + 2 * DAY })),
          1,
        ),
      ],
      NOW,
    );

    const double = result.metrics.find((m) => m.name === 'double');
    const single = result.metrics.find((m) => m.name === 'single');
    expect(double?.drawWeight).toBeCloseTo((single?.drawWeight ?? 0) * 2, 5);
  });

  it('draws on exactly the weight it reports, so the trace cannot disagree with the draw', () => {
    const candidates = [
      withSelectionWeight(
        candidate('double', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        2,
      ),
      withSelectionWeight(
        candidate('single', snapshot({ sevenDayReset: NOW + 2 * DAY })),
        1,
      ),
    ];

    const reported = useCase.run(candidates, NOW, () => 0).metrics;
    const doubleWeight =
      reported.find((m) => m.name === 'double')?.drawWeight ?? 0;
    const singleWeight =
      reported.find((m) => m.name === 'single')?.drawWeight ?? 0;
    const boundary = doubleWeight / (doubleWeight + singleWeight);

    expect(
      useCase.run(candidates, NOW, () => boundary - 0.01).selected?.name,
    ).toBe('double');
    expect(
      useCase.run(candidates, NOW, () => boundary + 0.01).selected?.name,
    ).toBe('single');
  });
});

describe('sevenDayUrgencyFactor', () => {
  const now = 1_000_000;

  it('grows as the seven day window gets closer to its reset', () => {
    const nearReset = sevenDayUrgencyFactor(0.5, now + 8 * 3600, now);
    const farReset = sevenDayUrgencyFactor(0.5, now + 160 * 3600, now);

    expect(nearReset).toBeGreaterThan(farReset);
  });

  it('scales with the free ratio of the seven day window', () => {
    const halfFree = sevenDayUrgencyFactor(0.5, now + 24 * 3600, now);
    const fullyFree = sevenDayUrgencyFactor(1, now + 24 * 3600, now);

    expect(fullyFree).toBeCloseTo(halfFree * 2);
  });

  it('clips the remaining hours at one hour so an imminent reset does not produce an unbounded factor', () => {
    const almostReset = sevenDayUrgencyFactor(1, now + 60, now);

    expect(almostReset).toBe(SEVEN_DAY_WINDOW_HOURS);
  });
});

describe('OauthTokenSelectUseCase with CL script thresholds', () => {
  const useCase = new OauthTokenSelectUseCase();

  it('excludes a token whose 5h window is less than 60% free when using CL script thresholds', () => {
    const result = useCase.run(
      [
        candidate('busy5h', snapshot({ fiveHourUtilization: 0.41 })),
        candidate('ok', snapshot({ fiveHourUtilization: 0.4 })),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy5h');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('5h window');
  });

  it('treats exactly 40% used 5h utilization as eligible under CL script thresholds (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ fiveHourUtilization: 0.4 }))],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('boundary');
    const boundary = result.metrics.find((m) => m.name === 'boundary');
    expect(boundary?.fiveHourFreeRatio).toBeCloseTo(0.6, 9);
  });

  it('excludes a token whose 7d window is less than 14% free when using CL script thresholds', () => {
    const result = useCase.run(
      [
        candidate('busy7d', snapshot({ sevenDayUtilization: 0.87 })),
        candidate('ok', snapshot({ sevenDayUtilization: 0.86 })),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('ok');
    const busy = result.metrics.find((m) => m.name === 'busy7d');
    expect(busy?.eligible).toBe(false);
    expect(busy?.exclusionReason).toContain('7d window');
  });

  it('treats exactly 86% used 7d utilization as eligible under CL script thresholds (boundary)', () => {
    const result = useCase.run(
      [candidate('boundary', snapshot({ sevenDayUtilization: 0.86 }))],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('boundary');
    const boundary = result.metrics.find((m) => m.name === 'boundary');
    expect(boundary?.sevenDayFreeRatio).toBeCloseTo(0.14, 9);
  });

  it('returns null when only a token with 59% 5h free is available under CL script thresholds', () => {
    const result = useCase.run(
      [candidate('marginal', snapshot({ fiveHourUtilization: 0.41 }))],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected).toBeNull();
  });

  it('returns null when only a token with 13% 7d free is available under CL script thresholds', () => {
    const result = useCase.run(
      [candidate('marginal', snapshot({ sevenDayUtilization: 0.87 }))],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected).toBeNull();
  });

  it('includes the correct threshold percentages in the exclusion reason message', () => {
    const result = useCase.run(
      [candidate('low5h', snapshot({ fiveHourUtilization: 0.5 }))],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    const low5h = result.metrics.find((m) => m.name === 'low5h');
    expect(low5h?.exclusionReason).toContain('60%');
  });
});
