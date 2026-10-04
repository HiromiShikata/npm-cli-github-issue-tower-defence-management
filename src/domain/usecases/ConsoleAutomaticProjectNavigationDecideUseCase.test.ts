import {
  type ConsoleAutomaticProjectNavigationDecideInput,
  type ConsoleAutomaticProjectNavigationDecideResult,
  DEFAULT_TIMER_MINUTES,
  consoleAutomaticProjectNavigationDecide,
  findNextPjcodeWithMinutes,
} from './ConsoleAutomaticProjectNavigationDecideUseCase';

describe('DEFAULT_TIMER_MINUTES and findNextPjcodeWithMinutes exported from the domain use case', () => {
  it('defines DEFAULT_TIMER_MINUTES as 15 minutes', () => {
    expect(DEFAULT_TIMER_MINUTES).toBe(15);
  });

  it('finds the next pjcode after the current one with minutes greater than zero', () => {
    expect(
      findNextPjcodeWithMinutes(['acme', 'beta', 'gamma'], 'acme', {
        acme: 30,
        beta: 30,
        gamma: 30,
      }),
    ).toBe('beta');
  });

  it('wraps around to the first pjcode after the last one', () => {
    expect(
      findNextPjcodeWithMinutes(['acme', 'beta', 'gamma'], 'gamma', {
        acme: 30,
        beta: 30,
        gamma: 30,
      }),
    ).toBe('acme');
  });

  it('falls back to DEFAULT_TIMER_MINUTES for a project missing from projectMinutes', () => {
    expect(findNextPjcodeWithMinutes(['acme', 'beta'], 'acme', {})).toBe(
      'beta',
    );
  });

  it('returns null when the pjcodes list is empty', () => {
    expect(findNextPjcodeWithMinutes([], null, {})).toBeNull();
  });
});

describe('consoleAutomaticProjectNavigationDecide', () => {
  const baseInput: ConsoleAutomaticProjectNavigationDecideInput = {
    actionNewlyEnqueued: false,
    timerElapsed: false,
    remainingCountIsZero: false,
    snapshotsReady: true,
    explicitlySelectedPjcodeMatchesCurrent: false,
    pjcode: 'acme',
    pjcodes: ['acme', 'beta'],
    projectMinutes: { acme: 30, beta: 30 },
    skipCount: 0,
    evaluatedPjcode: null,
  };

  type TableCase = {
    name: string;
    input: ConsoleAutomaticProjectNavigationDecideInput;
    expected: ConsoleAutomaticProjectNavigationDecideResult;
  };

  const parameterizedIssueTableCases: TableCase[] = [
    {
      name: 'row 1: switches once a write confirmed succeeded while the timer condition still holds',
      input: { ...baseInput, actionNewlyEnqueued: true, timerElapsed: true },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 2: stays with no switch while the timer-triggering write is not confirmed succeeded (confirmed failed)',
      input: { ...baseInput, actionNewlyEnqueued: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 3: a retry that succeeds switches once still elapsed at confirmation (the preceding failed attempt stays like row 2)',
      input: { ...baseInput, actionNewlyEnqueued: true, timerElapsed: true },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 4: switches once a write confirmed succeeded while the remaining count is still zero',
      input: {
        ...baseInput,
        actionNewlyEnqueued: true,
        timerElapsed: false,
        remainingCountIsZero: true,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: 'row 5: identical to baseInput — this function has no write-confirmation gate for the remaining-count-zero trigger (a confirmed-failed write), that gate is enforced only by the caller never invoking this function while writeState is failed; see the sibling assertion after this table and "does not navigate while the write is confirmed failed, even when the remaining count is zero" in useConsoleAutomaticProjectNavigation.test.ts for the real proof',
      input: { ...baseInput, actionNewlyEnqueued: false },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 6: exactly one switch (via the timer branch) when both the timer and remaining-count conditions hold at confirmation',
      input: {
        ...baseInput,
        actionNewlyEnqueued: true,
        timerElapsed: true,
        remainingCountIsZero: true,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 7: stays with no switch when the timer-triggering action was undone before any write was ever sent',
      input: { ...baseInput, actionNewlyEnqueued: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 8: identical to baseInput — this function has no write-confirmation gate for the remaining-count-zero trigger (an action undone before any write was sent), that gate is enforced only by the caller never invoking this function while a write is unconfirmed; see the sibling assertion after this table and the undo-while-remaining-count-zero test in ConsolePage.test.tsx for the real proof',
      input: { ...baseInput, actionNewlyEnqueued: false },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 9: stays with no switch when neither trigger condition holds, leaving the unaffected same-project advance to run',
      input: {
        ...baseInput,
        actionNewlyEnqueued: true,
        timerElapsed: false,
        remainingCountIsZero: false,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 10: no switch when the timer condition held at action time but no longer holds at confirmation',
      input: { ...baseInput, actionNewlyEnqueued: true, timerElapsed: false },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 11: stays indefinitely with no switch while the timer-triggering write is queued offline after a network failure',
      input: { ...baseInput, actionNewlyEnqueued: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: "switches to another project with positive minutes when the current project's own effective minutes are zero, even though remainingCountIsZero is false and the dedup lock has not been set",
      input: {
        ...baseInput,
        projectMinutes: { acme: 0, beta: 30 },
        remainingCountIsZero: false,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: "switches to another project with positive minutes when the current project's own effective minutes are zero, even though remainingCountIsZero is true and the dedup lock has not been set",
      input: {
        ...baseInput,
        projectMinutes: { acme: 0, beta: 30 },
        remainingCountIsZero: true,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: "stays when the current project's own effective minutes are zero and every other project also has zero effective minutes",
      input: {
        ...baseInput,
        projectMinutes: { acme: 0, beta: 0 },
        remainingCountIsZero: false,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: "switches to another project with positive minutes when the current project's own effective minutes are zero, even though the dedup lock is already set to the current project with no other-project gain",
      input: {
        ...baseInput,
        projectMinutes: { acme: 0, beta: 30 },
        remainingCountIsZero: false,
        evaluatedPjcode: 'acme',
        aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated: false,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: "stays when the current project's own effective minutes are positive and another project also has positive minutes, confirming the zero-minutes fix leaves this unaffected",
      input: {
        ...baseInput,
        projectMinutes: { acme: 30, beta: 30 },
        remainingCountIsZero: false,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: "stays when the current project's own effective minutes are positive and the only other project has zero minutes, confirming the zero-minutes fix leaves this unaffected",
      input: {
        ...baseInput,
        projectMinutes: { acme: 30, beta: 0 },
        remainingCountIsZero: true,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: "switches to another project with positive minutes when the current project's own effective minutes are zero, even though the current project was explicitly selected",
      input: {
        ...baseInput,
        projectMinutes: { acme: 0, beta: 30 },
        remainingCountIsZero: false,
        explicitlySelectedPjcodeMatchesCurrent: true,
        evaluatedPjcode: null,
      },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
  ];

  it.each(parameterizedIssueTableCases)('$name', ({ input, expected }) => {
    expect(consoleAutomaticProjectNavigationDecide(input)).toEqual(expected);
  });

  it('rows 5 and 8 (detail): calling this function directly with remainingCountIsZero true and actionNewlyEnqueued false switches regardless of why the write was never confirmed succeeded, proving the write-confirmation gate for the remaining-count-zero trigger lives entirely in the caller and not in this function', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      actionNewlyEnqueued: false,
      timerElapsed: false,
      remainingCountIsZero: true,
    });
    expect(decision.targetPjcode).toBe('beta');
  });

  it('row 6 (detail): the remaining-count branch bookkeeping is never advanced when the timer branch already decided', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      actionNewlyEnqueued: true,
      timerElapsed: true,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(decision.targetPjcode).toBe('beta');
    expect(decision.nextSkipCount).toBe(0);
    expect(decision.nextEvaluatedPjcode).toBeNull();
    const remainingCountBranchAlone = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      actionNewlyEnqueued: false,
      timerElapsed: false,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(remainingCountBranchAlone.nextSkipCount).toBe(1);
    expect(remainingCountBranchAlone.nextEvaluatedPjcode).toBe('acme');
  });

  const singleCallBranchCases: TableCase[] = [
    {
      name: 'resets skip tracking to zero and null when the remaining count is no longer zero, regardless of prior tracking state',
      input: {
        ...baseInput,
        remainingCountIsZero: false,
        skipCount: 2,
        evaluatedPjcode: 'beta',
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'leaves skip tracking unchanged when snapshots are not yet ready',
      input: {
        ...baseInput,
        snapshotsReady: false,
        remainingCountIsZero: true,
        skipCount: 2,
        evaluatedPjcode: 'beta',
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 2,
        nextEvaluatedPjcode: 'beta',
      },
    },
    {
      name: 'leaves skip tracking unchanged when no project codes are known yet (race condition before pjcodes load)',
      input: {
        ...baseInput,
        pjcodes: [],
        remainingCountIsZero: true,
        skipCount: 2,
        evaluatedPjcode: 'beta',
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 2,
        nextEvaluatedPjcode: 'beta',
      },
    },
    {
      name: 'stays and marks the current project evaluated when no other project has configured minutes',
      input: {
        ...baseInput,
        pjcodes: ['acme'],
        projectMinutes: { acme: 30 },
        remainingCountIsZero: true,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: 'navigates to the next project including an unconfigured one that falls back to DEFAULT_TIMER_MINUTES',
      input: {
        ...baseInput,
        pjcodes: ['acme', 'no-timer', 'beta'],
        projectMinutes: { acme: 30, beta: 30 },
        remainingCountIsZero: true,
      },
      expected: {
        targetPjcode: 'no-timer',
        nextSkipCount: 1,
        nextEvaluatedPjcode: 'acme',
      },
    },
  ];

  it.each(singleCallBranchCases)('$name', ({ input, expected }) => {
    expect(consoleAutomaticProjectNavigationDecide(input)).toEqual(expected);
  });

  it('switches away from the current project even though it was already marked evaluated, when a project gained remaining minutes since the last evaluation (dedup lock no longer blocks a live-eligible switch)', () => {
    const result = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'acme',
      evaluatedPjcode: 'acme',
      remainingCountIsZero: true,
      skipCount: 2,
      aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated: true,
    });
    expect(result.targetPjcode).toBe('beta');
  });

  it('leaves the evaluated-project lock in place when no project gained remaining minutes since the last evaluation, even though a project objectively has remaining minutes (prevents an infinite switch loop)', () => {
    const result = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'acme',
      evaluatedPjcode: 'acme',
      remainingCountIsZero: true,
      skipCount: 2,
    });
    expect(result.targetPjcode).toBeNull();
  });

  it('never switches back and forth indefinitely between two projects that both keep nonzero remaining minutes forever, across many evaluations with no gained-minutes signal', () => {
    let pjcode = 'acme';
    let skipCount = 0;
    let evaluatedPjcode: string | null = null;
    const targetPjcodesOverTwentyEvaluations: (string | null)[] = [];
    for (let evaluation = 0; evaluation < 20; evaluation++) {
      const result = consoleAutomaticProjectNavigationDecide({
        ...baseInput,
        pjcode,
        skipCount,
        evaluatedPjcode,
        remainingCountIsZero: true,
      });
      targetPjcodesOverTwentyEvaluations.push(result.targetPjcode);
      skipCount = result.nextSkipCount;
      evaluatedPjcode = result.nextEvaluatedPjcode;
      if (result.targetPjcode !== null) {
        pjcode = result.targetPjcode;
      }
    }
    const switchCount = targetPjcodesOverTwentyEvaluations.filter(
      (targetPjcode) => targetPjcode !== null,
    ).length;
    expect(switchCount).toBeLessThanOrEqual(1);
  });

  it('switches away from the current project even though it was explicitly selected (explicit-selection lock no longer blocks a live-eligible switch)', () => {
    const result = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      explicitlySelectedPjcodeMatchesCurrent: true,
      remainingCountIsZero: true,
      skipCount: 2,
      evaluatedPjcode: 'beta',
    });
    expect(result.targetPjcode).toBe('beta');
  });

  it('switches to a project that gains remaining minutes after the skip-exhaustion lock was set on the current project', () => {
    const firstResult = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: ['acme', 'beta', 'gamma'],
      projectMinutes: { acme: 30, beta: 0, gamma: 0 },
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });

    const secondResult = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: ['acme', 'beta', 'gamma'],
      projectMinutes: { acme: 30, beta: 30, gamma: 0 },
      remainingCountIsZero: true,
      skipCount: firstResult.nextSkipCount,
      evaluatedPjcode: firstResult.nextEvaluatedPjcode,
      aProjectGainedRemainingMinutesSinceTheCurrentProjectWasLastEvaluated: true,
    });
    expect(secondResult.targetPjcode).toBe('beta');
  });

  it('switches to a project that gains remaining minutes after the explicit-selection lock was set on the current project', () => {
    const firstResult = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: ['acme', 'beta'],
      explicitlySelectedPjcodeMatchesCurrent: true,
      projectMinutes: { acme: 30, beta: 0 },
      remainingCountIsZero: true,
    });
    expect(firstResult.targetPjcode).toBeNull();

    const secondResult = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: ['acme', 'beta'],
      explicitlySelectedPjcodeMatchesCurrent: true,
      projectMinutes: { acme: 30, beta: 30 },
      remainingCountIsZero: true,
      skipCount: firstResult.nextSkipCount,
      evaluatedPjcode: firstResult.nextEvaluatedPjcode,
    });
    expect(secondResult.targetPjcode).toBe('beta');
  });

  it('does not re-navigate for the same pjcode on a second evaluation (dedup across calls)', () => {
    const first = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(first).toEqual({
      targetPjcode: 'beta',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'acme',
    });

    const second = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: true,
      skipCount: first.nextSkipCount,
      evaluatedPjcode: first.nextEvaluatedPjcode,
    });
    expect(second).toEqual({
      targetPjcode: null,
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'acme',
    });
  });

  it('stops skipping after all projects with minutes are exhausted, then resets', () => {
    const atAcme = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(atAcme.targetPjcode).toBe('beta');

    const atBeta = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      remainingCountIsZero: true,
      skipCount: atAcme.nextSkipCount,
      evaluatedPjcode: atAcme.nextEvaluatedPjcode,
    });
    expect(atBeta).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: 'beta',
    });
  });

  it('resets the skip counter and navigates again when arriving at a project with items, then re-skips from there', () => {
    const threeProjects = ['acme', 'beta', 'gamma'];
    const threeProjectMinutes = { acme: 30, beta: 30, gamma: 30 };

    const atAcme = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: threeProjects,
      projectMinutes: threeProjectMinutes,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(atAcme.targetPjcode).toBe('beta');

    const atBetaWithItems = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      pjcodes: threeProjects,
      projectMinutes: threeProjectMinutes,
      remainingCountIsZero: false,
      skipCount: atAcme.nextSkipCount,
      evaluatedPjcode: atAcme.nextEvaluatedPjcode,
    });
    expect(atBetaWithItems).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: null,
    });

    const atGamma = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'gamma',
      pjcodes: threeProjects,
      projectMinutes: threeProjectMinutes,
      remainingCountIsZero: true,
      skipCount: atBetaWithItems.nextSkipCount,
      evaluatedPjcode: atBetaWithItems.nextEvaluatedPjcode,
    });
    expect(atGamma).toEqual({
      targetPjcode: 'acme',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'gamma',
    });
  });

  it('completes a full skip cycle through unconfigured projects before resetting', () => {
    const projects = ['acme', 'no-timer', 'beta'];
    const minutes = { acme: 30, beta: 30 };

    const atAcme = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcodes: projects,
      projectMinutes: minutes,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(atAcme).toEqual({
      targetPjcode: 'no-timer',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'acme',
    });

    const atNoTimer = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'no-timer',
      pjcodes: projects,
      projectMinutes: minutes,
      remainingCountIsZero: true,
      skipCount: atAcme.nextSkipCount,
      evaluatedPjcode: atAcme.nextEvaluatedPjcode,
    });
    expect(atNoTimer).toEqual({
      targetPjcode: 'beta',
      nextSkipCount: 2,
      nextEvaluatedPjcode: 'no-timer',
    });

    const atBeta = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      pjcodes: projects,
      projectMinutes: minutes,
      remainingCountIsZero: true,
      skipCount: atNoTimer.nextSkipCount,
      evaluatedPjcode: atNoTimer.nextEvaluatedPjcode,
    });
    expect(atBeta).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: 'beta',
    });
  });

  it('navigates once pjcodes loads after snapshots were already ready (race condition)', () => {
    const beforeLoad = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      pjcodes: [],
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(beforeLoad).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: null,
    });

    const afterLoad = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      pjcodes: ['acme', 'beta'],
      remainingCountIsZero: true,
      skipCount: beforeLoad.nextSkipCount,
      evaluatedPjcode: beforeLoad.nextEvaluatedPjcode,
    });
    expect(afterLoad).toEqual({
      targetPjcode: 'acme',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'beta',
    });
  });

  it('navigates to the next project once the remaining count drops from non-zero to zero while already on a project', () => {
    const withItems = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: false,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(withItems).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: null,
    });

    const afterDrop = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: true,
      skipCount: withItems.nextSkipCount,
      evaluatedPjcode: withItems.nextEvaluatedPjcode,
    });
    expect(afterDrop).toEqual({
      targetPjcode: 'beta',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'acme',
    });
  });

  it('navigates again from a previously-skipped project when returning to it after visiting a project with pending items', () => {
    const atAcme = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      remainingCountIsZero: true,
      skipCount: 0,
      evaluatedPjcode: null,
    });
    expect(atAcme.targetPjcode).toBe('beta');

    const atBetaWithItems = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'beta',
      remainingCountIsZero: false,
      skipCount: atAcme.nextSkipCount,
      evaluatedPjcode: atAcme.nextEvaluatedPjcode,
    });
    expect(atBetaWithItems).toEqual({
      targetPjcode: null,
      nextSkipCount: 0,
      nextEvaluatedPjcode: null,
    });

    const backAtAcme = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      pjcode: 'acme',
      remainingCountIsZero: true,
      skipCount: atBetaWithItems.nextSkipCount,
      evaluatedPjcode: atBetaWithItems.nextEvaluatedPjcode,
    });
    expect(backAtAcme).toEqual({
      targetPjcode: 'beta',
      nextSkipCount: 1,
      nextEvaluatedPjcode: 'acme',
    });
  });
});

describe('consoleAutomaticProjectNavigationDecide — no auto-switch while a task is open (#32963)', () => {
  const taskOpenGuardBaseInput: ConsoleAutomaticProjectNavigationDecideInput = {
    actionNewlyEnqueued: false,
    timerElapsed: false,
    remainingCountIsZero: false,
    snapshotsReady: true,
    explicitlySelectedPjcodeMatchesCurrent: false,
    pjcode: 'acme',
    pjcodes: ['acme', 'beta'],
    projectMinutes: { acme: 30, beta: 30 },
    skipCount: 0,
    evaluatedPjcode: null,
  };

  type TaskOpenTableCase = {
    name: string;
    input: ConsoleAutomaticProjectNavigationDecideInput;
    expectedTargetPjcode: string | null;
  };

  const taskOpenTableCases: TaskOpenTableCase[] = [
    {
      name: 'taskOpen=false, remainingCountIsZero=false, explicitMatch=false, elapsedTimeTriggerHolds=false -> no switch',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: false,
        remainingCountIsZero: false,
        explicitlySelectedPjcodeMatchesCurrent: false,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: null,
    },
    {
      name: 'taskOpen=false, remainingCountIsZero=true, explicitMatch=false, elapsedTimeTriggerHolds=false -> switches to beta',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: false,
        remainingCountIsZero: true,
        explicitlySelectedPjcodeMatchesCurrent: false,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: 'beta',
    },
    {
      name: 'taskOpen=true, remainingCountIsZero=true, explicitMatch=false, elapsedTimeTriggerHolds=false -> no switch while a task is open',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: true,
        remainingCountIsZero: true,
        explicitlySelectedPjcodeMatchesCurrent: false,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: null,
    },
    {
      name: 'taskOpen=true, remainingCountIsZero=false, explicitMatch=false, elapsedTimeTriggerHolds=false -> no switch',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: true,
        remainingCountIsZero: false,
        explicitlySelectedPjcodeMatchesCurrent: false,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: null,
    },
    {
      name: 'taskOpen=false, remainingCountIsZero=true, explicitMatch=true, elapsedTimeTriggerHolds=false -> switches to beta (explicit-selection no longer blocks a live-eligible switch)',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: false,
        remainingCountIsZero: true,
        explicitlySelectedPjcodeMatchesCurrent: true,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: 'beta',
    },
    {
      name: 'taskOpen=true, remainingCountIsZero=true, explicitMatch=true, elapsedTimeTriggerHolds=false -> no switch',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: true,
        remainingCountIsZero: true,
        explicitlySelectedPjcodeMatchesCurrent: true,
        actionNewlyEnqueued: false,
        timerElapsed: false,
      },
      expectedTargetPjcode: null,
    },
    {
      name: 'taskOpen=true, remainingCountIsZero=false, explicitMatch=false, elapsedTimeTriggerHolds=true -> switches via the prior-action elapsed-time branch regardless of taskOpen',
      input: {
        ...taskOpenGuardBaseInput,
        taskOpen: true,
        remainingCountIsZero: false,
        explicitlySelectedPjcodeMatchesCurrent: false,
        actionNewlyEnqueued: true,
        timerElapsed: true,
      },
      expectedTargetPjcode: 'beta',
    },
  ];

  it.each(taskOpenTableCases)('$name', ({ input, expectedTargetPjcode }) => {
    expect(consoleAutomaticProjectNavigationDecide(input).targetPjcode).toBe(
      expectedTargetPjcode,
    );
  });

  it('preserves skipCount and evaluatedPjcode exactly as they were before the task was opened, instead of resetting them', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...taskOpenGuardBaseInput,
      taskOpen: true,
      remainingCountIsZero: true,
      explicitlySelectedPjcodeMatchesCurrent: false,
      actionNewlyEnqueued: false,
      timerElapsed: false,
      skipCount: 2,
      evaluatedPjcode: 'beta',
    });
    expect(decision).toEqual({
      targetPjcode: null,
      nextSkipCount: 2,
      nextEvaluatedPjcode: 'beta',
    });
  });
});

describe('consoleAutomaticProjectNavigationDecide — actionNewlyEnqueued/timerElapsed/remainingCountIsZero/taskOpen combinations (#33007)', () => {
  const fixedInputBase: Omit<
    ConsoleAutomaticProjectNavigationDecideInput,
    'actionNewlyEnqueued' | 'timerElapsed' | 'remainingCountIsZero' | 'taskOpen'
  > = {
    snapshotsReady: true,
    explicitlySelectedPjcodeMatchesCurrent: false,
    pjcode: 'acme',
    pjcodes: ['acme', 'beta'],
    projectMinutes: { acme: 30, beta: 30 },
    skipCount: 0,
    evaluatedPjcode: null,
  };

  type CombinationTableCase = {
    actionNewlyEnqueued: boolean;
    timerElapsed: boolean;
    remainingCountIsZero: boolean;
    taskOpen: boolean;
    expectedTargetPjcode: string | null;
    description: string;
  };

  const combinationTableCases: CombinationTableCase[] = [
    {
      actionNewlyEnqueued: false,
      timerElapsed: false,
      remainingCountIsZero: false,
      taskOpen: false,
      expectedTargetPjcode: null,
      description: 'no change',
    },
    {
      actionNewlyEnqueued: false,
      timerElapsed: false,
      remainingCountIsZero: true,
      taskOpen: false,
      expectedTargetPjcode: 'beta',
      description: 'switch to beta (remainingCountIsZero path)',
    },
    {
      actionNewlyEnqueued: false,
      timerElapsed: false,
      remainingCountIsZero: true,
      taskOpen: true,
      expectedTargetPjcode: null,
      description: 'no change (taskOpen suppresses remainingCountIsZero path)',
    },
    {
      actionNewlyEnqueued: true,
      timerElapsed: true,
      remainingCountIsZero: false,
      taskOpen: false,
      expectedTargetPjcode: 'beta',
      description:
        'switch to beta (timerElapsed path, the main point of this fix)',
    },
    {
      actionNewlyEnqueued: true,
      timerElapsed: true,
      remainingCountIsZero: false,
      taskOpen: true,
      expectedTargetPjcode: 'beta',
      description:
        'switch to beta (timerElapsed path NOT suppressed by taskOpen)',
    },
    {
      actionNewlyEnqueued: true,
      timerElapsed: true,
      remainingCountIsZero: true,
      taskOpen: false,
      expectedTargetPjcode: 'beta',
      description: 'switch to beta (both paths true, switches only once)',
    },
    {
      actionNewlyEnqueued: true,
      timerElapsed: false,
      remainingCountIsZero: true,
      taskOpen: false,
      expectedTargetPjcode: 'beta',
      description: 'switch to beta (remainingCountIsZero path)',
    },
    {
      actionNewlyEnqueued: true,
      timerElapsed: false,
      remainingCountIsZero: false,
      taskOpen: false,
      expectedTargetPjcode: null,
      description: 'no change',
    },
  ];

  it.each(combinationTableCases)(
    'actionNewlyEnqueued=$actionNewlyEnqueued timerElapsed=$timerElapsed remainingCountIsZero=$remainingCountIsZero taskOpen=$taskOpen -> $description',
    ({
      actionNewlyEnqueued,
      timerElapsed,
      remainingCountIsZero,
      taskOpen,
      expectedTargetPjcode,
    }) => {
      const decision = consoleAutomaticProjectNavigationDecide({
        ...fixedInputBase,
        actionNewlyEnqueued,
        timerElapsed,
        remainingCountIsZero,
        taskOpen,
      });
      expect(decision.targetPjcode).toBe(expectedTargetPjcode);
    },
  );

  it('switches to the next project exactly once (not twice) when both the timerElapsed path and the remainingCountIsZero path hold for the same newly enqueued action', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...fixedInputBase,
      actionNewlyEnqueued: true,
      timerElapsed: true,
      remainingCountIsZero: true,
      taskOpen: false,
    });
    expect(decision.targetPjcode).toBe('beta');
    expect(decision.nextSkipCount).toBe(0);
    expect(decision.nextEvaluatedPjcode).toBeNull();
  });
});
