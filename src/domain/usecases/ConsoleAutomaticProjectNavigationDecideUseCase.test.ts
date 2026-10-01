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
    checkTimerElapsed: false,
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
      input: { ...baseInput, checkTimerElapsed: true, timerElapsed: true },
      expected: {
        targetPjcode: 'beta',
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 2: stays with no switch while the timer-triggering write is not confirmed succeeded (confirmed failed)',
      input: { ...baseInput, checkTimerElapsed: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 3: a retry that succeeds switches once still elapsed at confirmation (the preceding failed attempt stays like row 2)',
      input: { ...baseInput, checkTimerElapsed: true, timerElapsed: true },
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
        checkTimerElapsed: true,
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
      input: { ...baseInput, checkTimerElapsed: false },
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
        checkTimerElapsed: true,
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
      input: { ...baseInput, checkTimerElapsed: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 8: identical to baseInput — this function has no write-confirmation gate for the remaining-count-zero trigger (an action undone before any write was sent), that gate is enforced only by the caller never invoking this function while a write is unconfirmed; see the sibling assertion after this table and the undo-while-remaining-count-zero test in ConsolePage.test.tsx for the real proof',
      input: { ...baseInput, checkTimerElapsed: false },
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
        checkTimerElapsed: true,
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
      input: { ...baseInput, checkTimerElapsed: true, timerElapsed: false },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
    {
      name: 'row 11: stays indefinitely with no switch while the timer-triggering write is queued offline after a network failure',
      input: { ...baseInput, checkTimerElapsed: false, timerElapsed: true },
      expected: {
        targetPjcode: null,
        nextSkipCount: 0,
        nextEvaluatedPjcode: null,
      },
    },
  ];

  it.each(parameterizedIssueTableCases)('$name', ({ input, expected }) => {
    expect(consoleAutomaticProjectNavigationDecide(input)).toEqual(expected);
  });

  it('rows 5 and 8 (detail): calling this function directly with remainingCountIsZero true and checkTimerElapsed false switches regardless of why the write was never confirmed succeeded, proving the write-confirmation gate for the remaining-count-zero trigger lives entirely in the caller and not in this function', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      checkTimerElapsed: false,
      timerElapsed: false,
      remainingCountIsZero: true,
    });
    expect(decision.targetPjcode).toBe('beta');
  });

  it('row 6 (detail): the remaining-count branch bookkeeping is never advanced when the timer branch already decided', () => {
    const decision = consoleAutomaticProjectNavigationDecide({
      ...baseInput,
      checkTimerElapsed: true,
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
      checkTimerElapsed: false,
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
      name: 'leaves skip tracking unchanged when the current project was already evaluated (dedup)',
      input: {
        ...baseInput,
        pjcode: 'acme',
        evaluatedPjcode: 'acme',
        remainingCountIsZero: true,
        skipCount: 2,
      },
      expected: {
        targetPjcode: null,
        nextSkipCount: 2,
        nextEvaluatedPjcode: 'acme',
      },
    },
    {
      name: 'leaves skip tracking unchanged when the explicitly selected project matches the current one',
      input: {
        ...baseInput,
        explicitlySelectedPjcodeMatchesCurrent: true,
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
