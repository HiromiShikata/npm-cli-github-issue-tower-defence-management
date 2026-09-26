import {
  CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
  OauthTokenCandidate,
  OauthTokenSelectUseCase,
  OauthTokenWindowSnapshot,
  SEVEN_DAY_WINDOW_HOURS,
  isSevenDayBudgetUnspendableBeforeSpendDeadline,
  oauthTokenDrainOrderSort,
  oauthTokenFillTargetSelect,
  sevenDayFreeRatioSpendableBeforeSpendDeadlineOf,
  sevenDayUrgencyFactor,
  windowFreeRatioOfUtilization,
} from './OauthTokenSelectUseCase';

const NOW = 1_000_000;
const HOUR = 3600;
const DAY = 86400;

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

  it('applies no 5h or 7d free-ratio cutoff when no thresholds are passed', () => {
    const cases: Array<{
      description: string;
      snapshot: OauthTokenWindowSnapshot;
    }> = [
      {
        description: '5h window 24% free, far from its reset',
        snapshot: snapshot({
          fiveHourUtilization: 0.76,
          fiveHourReset: NOW + 4 * HOUR,
        }),
      },
      {
        description: '5h window fully used, far from its reset',
        snapshot: snapshot({
          fiveHourUtilization: 1,
          fiveHourReset: NOW + 4 * HOUR,
        }),
      },
      {
        description: '7d window 0.5% free, more than 48 hours before its reset',
        snapshot: snapshot({
          sevenDayUtilization: 0.995,
          sevenDayReset: NOW + 100 * HOUR,
        }),
      },
      {
        description: 'both windows fully used, far from their resets',
        snapshot: snapshot({
          fiveHourUtilization: 1,
          fiveHourReset: NOW + 4 * HOUR,
          sevenDayUtilization: 1,
          sevenDayReset: NOW + 100 * HOUR,
        }),
      },
    ];

    for (const testCase of cases) {
      const result = useCase.run(
        [candidate(testCase.description, testCase.snapshot)],
        NOW,
      );

      expect({
        description: testCase.description,
        selectedName: result.selected?.name ?? null,
        eligible: result.metrics[0]?.eligible,
        exclusionReason: result.metrics[0]?.exclusionReason,
      }).toEqual({
        description: testCase.description,
        selectedName: testCase.description,
        eligible: true,
        exclusionReason: null,
      });
    }
  });

  it('excludes a token whose 5h window is below the CL script 5h free-ratio threshold', () => {
    const result = useCase.run(
      [
        candidate('busy5h', snapshot({ fiveHourUtilization: 0.76 })),
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

  it('excludes a token whose 7d window is below the CL script 7d free-ratio threshold', () => {
    const result = useCase.run(
      [
        candidate('busy7d', snapshot({ sevenDayUtilization: 0.995 })),
        candidate('ok', snapshot({ sevenDayUtilization: 0.8 })),
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
        candidate('rejected', snapshot({}), false, true),
        candidate('fableOut', snapshot({}), false, false, true),
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

  it('excludes a token whose blockedUntilEpoch is in the future', () => {
    const result = useCase.run(
      [
        {
          ...candidate('auth-failed', snapshot({})),
          blockedUntilEpoch: NOW + 1,
        },
        candidate('active', snapshot({})),
      ],
      NOW,
    );

    expect(result.selected?.name).toBe('active');
    const authFailed = result.metrics.find((m) => m.name === 'auth-failed');
    expect(authFailed?.eligible).toBe(false);
    expect(authFailed?.exclusionReason).toContain('token auth failure');
  });

  it('treats a token whose blockedUntilEpoch equals nowEpochSeconds as eligible', () => {
    const result = useCase.run(
      [{ ...candidate('exactly', snapshot({})), blockedUntilEpoch: NOW }],
      NOW,
    );

    expect(result.selected?.name).toBe('exactly');
    const exactly = result.metrics.find((m) => m.name === 'exactly');
    expect(exactly?.eligible).toBe(true);
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
        candidate('blocked', snapshot({}), false, true),
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
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
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

  it('treats a token at the 48-hour spend deadline as maximally urgent for its free ratio', () => {
    const atDeadline = sevenDayUrgencyFactor(0.5, now + 48 * 3600, now);

    expect(atDeadline).toBe(0.5 * SEVEN_DAY_WINDOW_HOURS);
  });

  it('gives higher urgency at 72h-to-reset than at 76h-to-reset using hours-to-deadline as the denominator', () => {
    const closer = sevenDayUrgencyFactor(0.5, now + 72 * 3600, now);
    const further = sevenDayUrgencyFactor(0.5, now + 76 * 3600, now);

    expect(closer).toBeGreaterThan(further);
    expect(closer).toBeCloseTo((0.5 * SEVEN_DAY_WINDOW_HOURS) / 24, 5);
  });
});

describe('OauthTokenSelectUseCase spend-deadline bypass with CL script thresholds', () => {
  const useCase = new OauthTokenSelectUseCase();

  it('allows a token with less than the minimum seven day free ratio when within 48 hours of the seven day reset', () => {
    const result = useCase.run(
      [
        candidate(
          'nearReset7d',
          snapshot({
            sevenDayUtilization: 0.995,
            sevenDayReset: NOW + 30 * HOUR,
          }),
        ),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('nearReset7d');
    const nearReset = result.metrics.find((m) => m.name === 'nearReset7d');
    expect(nearReset?.eligible).toBe(true);
  });

  it('still excludes a token with less than the minimum seven day free ratio when more than 48 hours remain before reset', () => {
    const result = useCase.run(
      [
        candidate(
          'farReset7d',
          snapshot({
            sevenDayUtilization: 0.995,
            sevenDayReset: NOW + 50 * HOUR,
          }),
        ),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected).toBeNull();
    const farReset = result.metrics.find((m) => m.name === 'farReset7d');
    expect(farReset?.eligible).toBe(false);
    expect(farReset?.exclusionReason).toContain('7d window');
  });

  it('allows a token with less than the minimum five hour free ratio when within one hour of the five hour reset', () => {
    const result = useCase.run(
      [
        candidate(
          'nearReset5h',
          snapshot({ fiveHourUtilization: 0.9, fiveHourReset: NOW + HOUR / 2 }),
        ),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected?.name).toBe('nearReset5h');
    const nearReset = result.metrics.find((m) => m.name === 'nearReset5h');
    expect(nearReset?.eligible).toBe(true);
  });

  it('still excludes a token with less than the minimum five hour free ratio when more than one hour remains before reset', () => {
    const result = useCase.run(
      [
        candidate(
          'farReset5h',
          snapshot({ fiveHourUtilization: 0.9, fiveHourReset: NOW + 2 * HOUR }),
        ),
      ],
      NOW,
      Math.random,
      CL_SCRIPT_OAUTH_TOKEN_SELECTION_THRESHOLDS,
    );

    expect(result.selected).toBeNull();
    const farReset = result.metrics.find((m) => m.name === 'farReset5h');
    expect(farReset?.eligible).toBe(false);
    expect(farReset?.exclusionReason).toContain('5h window');
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

describe('windowFreeRatioOfUtilization', () => {
  it('returns one minus the utilization clamped to the range 0 to 1', () => {
    const cases: Array<{ utilization: number; expectedFreeRatio: number }> = [
      { utilization: -0.2, expectedFreeRatio: 1 },
      { utilization: 0, expectedFreeRatio: 1 },
      { utilization: 0.25, expectedFreeRatio: 0.75 },
      { utilization: 1, expectedFreeRatio: 0 },
      { utilization: 1.3, expectedFreeRatio: 0 },
    ];

    for (const testCase of cases) {
      expect({
        utilization: testCase.utilization,
        freeRatio: windowFreeRatioOfUtilization(testCase.utilization),
      }).toEqual({
        utilization: testCase.utilization,
        freeRatio: testCase.expectedFreeRatio,
      });
    }
  });
});

describe('sevenDayFreeRatioSpendableBeforeSpendDeadlineOf', () => {
  it('spends 14% of the 7d window per fully spent 5h window until 48 hours before the 7d reset', () => {
    const cases: Array<{
      description: string;
      secondsUntilSevenDayReset: number;
      expectedSpendableFreeRatio: number;
    }> = [
      {
        description: 'one 5h window before the deadline',
        secondsUntilSevenDayReset: 53 * HOUR,
        expectedSpendableFreeRatio: 0.14,
      },
      {
        description: 'two 5h windows before the deadline',
        secondsUntilSevenDayReset: 58 * HOUR,
        expectedSpendableFreeRatio: 0.28,
      },
      {
        description: 'half a 5h window before the deadline',
        secondsUntilSevenDayReset: 50.5 * HOUR,
        expectedSpendableFreeRatio: 0.07,
      },
      {
        description: 'ten 5h windows before the deadline',
        secondsUntilSevenDayReset: 98 * HOUR,
        expectedSpendableFreeRatio: 1.4,
      },
      {
        description: 'exactly at the deadline',
        secondsUntilSevenDayReset: 48 * HOUR,
        expectedSpendableFreeRatio: 0,
      },
      {
        description: 'past the deadline',
        secondsUntilSevenDayReset: 30 * HOUR,
        expectedSpendableFreeRatio: 0,
      },
      {
        description: 'reset already in the past',
        secondsUntilSevenDayReset: -1 * HOUR,
        expectedSpendableFreeRatio: 0,
      },
    ];

    for (const testCase of cases) {
      const spendable = sevenDayFreeRatioSpendableBeforeSpendDeadlineOf(
        testCase.secondsUntilSevenDayReset,
      );
      expect({
        description: testCase.description,
        spendable: Math.round(spendable * 1e9) / 1e9,
      }).toEqual({
        description: testCase.description,
        spendable: testCase.expectedSpendableFreeRatio,
      });
    }
  });

  it('treats an unknown 7d reset as an unlimited spendable budget', () => {
    expect(
      sevenDayFreeRatioSpendableBeforeSpendDeadlineOf(Number.POSITIVE_INFINITY),
    ).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('isSevenDayBudgetUnspendableBeforeSpendDeadline', () => {
  it('reports whether the remaining 7d budget exceeds what the concurrency cap can spend before the deadline', () => {
    const cases: Array<{
      description: string;
      sevenDayFreeRatio: number;
      secondsUntilSevenDayReset: number;
      expectedUnspendable: boolean;
    }> = [
      {
        description: '15% left with one 5h window before the deadline',
        sevenDayFreeRatio: 0.15,
        secondsUntilSevenDayReset: 53 * HOUR,
        expectedUnspendable: true,
      },
      {
        description: '13% left with one 5h window before the deadline',
        sevenDayFreeRatio: 0.13,
        secondsUntilSevenDayReset: 53 * HOUR,
        expectedUnspendable: false,
      },
      {
        description: '90% left with 12 hours before the deadline',
        sevenDayFreeRatio: 0.9,
        secondsUntilSevenDayReset: 60 * HOUR,
        expectedUnspendable: true,
      },
      {
        description: '30% left with 12 hours before the deadline',
        sevenDayFreeRatio: 0.3,
        secondsUntilSevenDayReset: 60 * HOUR,
        expectedUnspendable: false,
      },
      {
        description: '1% left after the deadline passed',
        sevenDayFreeRatio: 0.01,
        secondsUntilSevenDayReset: 30 * HOUR,
        expectedUnspendable: true,
      },
      {
        description: 'nothing left after the deadline passed',
        sevenDayFreeRatio: 0,
        secondsUntilSevenDayReset: 30 * HOUR,
        expectedUnspendable: false,
      },
      {
        description: 'fully free far from the reset',
        sevenDayFreeRatio: 1,
        secondsUntilSevenDayReset: 400 * HOUR,
        expectedUnspendable: false,
      },
      {
        description: 'fully free with an unknown reset',
        sevenDayFreeRatio: 1,
        secondsUntilSevenDayReset: Number.POSITIVE_INFINITY,
        expectedUnspendable: false,
      },
    ];

    for (const testCase of cases) {
      expect({
        description: testCase.description,
        unspendable: isSevenDayBudgetUnspendableBeforeSpendDeadline({
          sevenDayFreeRatio: testCase.sevenDayFreeRatio,
          secondsUntilSevenDayReset: testCase.secondsUntilSevenDayReset,
        }),
      }).toEqual({
        description: testCase.description,
        unspendable: testCase.expectedUnspendable,
      });
    }
  });
});

type DrainOrderTestCandidate = {
  name: string;
  sevenDayFreeRatio: number;
  secondsUntilSevenDayReset: number;
  remainingConcurrentSlotCount: number;
};

const drainCandidate = (
  name: string,
  sevenDayFreeRatio: number,
  secondsUntilSevenDayReset: number,
  remainingConcurrentSlotCount = 6,
): DrainOrderTestCandidate => ({
  name,
  sevenDayFreeRatio,
  secondsUntilSevenDayReset,
  remainingConcurrentSlotCount,
});

describe('oauthTokenDrainOrderSort', () => {
  it('orders by least 7d budget first with tokens whose budget cannot be spent before the deadline moved to the front', () => {
    const cases: Array<{
      description: string;
      candidates: DrainOrderTestCandidate[];
      expectedOrder: string[];
    }> = [
      {
        description:
          'a token that cannot be drained before the deadline moves ahead of a token with less budget',
        candidates: [
          drainCandidate('leastBudget', 0.1, 200 * HOUR),
          drainCandidate('undrainable', 0.9, 60 * HOUR),
        ],
        expectedOrder: ['undrainable', 'leastBudget'],
      },
      {
        description:
          'promoted tokens keep 7d free ratio ascending among themselves',
        candidates: [
          drainCandidate('promotedEightyPercentFree', 0.8, 30 * HOUR),
          drainCandidate('promotedThirtyPercentFree', 0.3, 20 * HOUR),
          drainCandidate('notPromotedFivePercentFree', 0.05, 300 * HOUR),
        ],
        expectedOrder: [
          'promotedThirtyPercentFree',
          'promotedEightyPercentFree',
          'notPromotedFivePercentFree',
        ],
      },
      {
        description:
          'equal 7d free ratio falls back to the sooner 7d reset, unknown reset last',
        candidates: [
          drainCandidate('reset300h', 0.5, 300 * HOUR),
          drainCandidate('resetUnknown', 0.5, Infinity),
          drainCandidate('reset200h', 0.5, 200 * HOUR),
        ],
        expectedOrder: ['reset200h', 'reset300h', 'resetUnknown'],
      },
      {
        description: 'equal 7d free ratio and reset keep the input order',
        candidates: [
          drainCandidate('listedFirst', 0.5, Infinity, 1),
          drainCandidate('listedSecond', 0.5, Infinity, 6),
        ],
        expectedOrder: ['listedFirst', 'listedSecond'],
      },
      {
        description: 'a token with an unknown reset is never promoted',
        candidates: [
          drainCandidate('fullyFreeUnknownReset', 1, Infinity),
          drainCandidate('ninetyFivePercentFree', 0.95, 200 * HOUR),
        ],
        expectedOrder: ['ninetyFivePercentFree', 'fullyFreeUnknownReset'],
      },
      {
        description: '7d reset ascending when no token is promoted',
        candidates: [
          drainCandidate('sixtyPercentFree', 0.6, 200 * HOUR),
          drainCandidate('twentyPercentFree', 0.2, 300 * HOUR),
          drainCandidate('fortyPercentFreeUnknownReset', 0.4, Infinity),
        ],
        expectedOrder: [
          'sixtyPercentFree',
          'twentyPercentFree',
          'fortyPercentFreeUnknownReset',
        ],
      },
    ];

    for (const testCase of cases) {
      expect({
        description: testCase.description,
        order: oauthTokenDrainOrderSort(testCase.candidates).map(
          (candidate) => candidate.name,
        ),
      }).toEqual({
        description: testCase.description,
        order: testCase.expectedOrder,
      });
    }
  });

  it('fills the token with the sooner 7d reset before one with a higher free ratio when neither token is promoted (reported defect: a token resetting sooner was starved while a token with a more distant reset and a lower free ratio absorbed the fill)', () => {
    const candidates = [
      drainCandidate('soonerResetHigherFreeRatio', 0.7, 6 * DAY + 4 * HOUR),
      drainCandidate('laterResetLowerFreeRatio', 0.3, 6 * DAY + 6 * HOUR),
    ];

    const sorted = oauthTokenDrainOrderSort(candidates);

    expect(sorted.map((candidate) => candidate.name)).toEqual([
      'soonerResetHigherFreeRatio',
      'laterResetLowerFreeRatio',
    ]);
  });

  it('returns a new array and leaves the input order unchanged', () => {
    const candidates = [
      drainCandidate('moreBudget', 0.9, 300 * HOUR),
      drainCandidate('lessBudget', 0.1, 300 * HOUR),
    ];

    const sorted = oauthTokenDrainOrderSort(candidates);

    expect(sorted.map((candidate) => candidate.name)).toEqual([
      'lessBudget',
      'moreBudget',
    ]);
    expect(candidates.map((candidate) => candidate.name)).toEqual([
      'moreBudget',
      'lessBudget',
    ]);
  });
});

describe('oauthTokenFillTargetSelect', () => {
  it('selects the first token in drain order that still has a free concurrent slot', () => {
    const cases: Array<{
      description: string;
      candidates: DrainOrderTestCandidate[];
      expectedName: string | null;
    }> = [
      {
        description:
          'the least-budget token while it still has a slot, even with fewer slots than another token',
        candidates: [
          drainCandidate('moreBudgetIdle', 0.9, 300 * HOUR, 6),
          drainCandidate('leastBudgetOneSlotLeft', 0.1, 300 * HOUR, 1),
        ],
        expectedName: 'leastBudgetOneSlotLeft',
      },
      {
        description: 'the next token once the least-budget token is at its cap',
        candidates: [
          drainCandidate('moreBudget', 0.9, 300 * HOUR, 2),
          drainCandidate('leastBudgetFull', 0.1, 300 * HOUR, 0),
        ],
        expectedName: 'moreBudget',
      },
      {
        description: 'a promoted token ahead of the least-budget token',
        candidates: [
          drainCandidate('leastBudget', 0.1, 300 * HOUR, 6),
          drainCandidate('undrainable', 0.9, 60 * HOUR, 6),
        ],
        expectedName: 'undrainable',
      },
      {
        description: 'no token when every token is at its cap',
        candidates: [
          drainCandidate('full', 0.1, 300 * HOUR, 0),
          drainCandidate('overCap', 0.5, 300 * HOUR, -2),
        ],
        expectedName: null,
      },
      {
        description: 'no token for an empty candidate list',
        candidates: [],
        expectedName: null,
      },
      {
        description:
          'the sooner-7d-reset token with a free slot fills before a later-7d-reset token with a lower free ratio and a free slot, neither promoted',
        candidates: [
          drainCandidate(
            'soonerResetHigherFreeRatio',
            0.7,
            6 * DAY + 4 * HOUR,
            6,
          ),
          drainCandidate(
            'laterResetLowerFreeRatio',
            0.3,
            6 * DAY + 6 * HOUR,
            6,
          ),
        ],
        expectedName: 'soonerResetHigherFreeRatio',
      },
    ];

    for (const testCase of cases) {
      expect({
        description: testCase.description,
        selectedName:
          oauthTokenFillTargetSelect(testCase.candidates)?.name ?? null,
      }).toEqual({
        description: testCase.description,
        selectedName: testCase.expectedName,
      });
    }
  });
});
