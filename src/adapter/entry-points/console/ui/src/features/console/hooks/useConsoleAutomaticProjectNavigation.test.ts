import { act, renderHook } from '@testing-library/react';
import { navigatePush } from '../lib/navigation';
import { ACTION_TOAST_DELAY_MS } from '../logic/actionToast';
import { useConsoleActionQueue } from './useConsoleActionQueue';
import { useConsoleAutomaticProjectNavigation } from './useConsoleAutomaticProjectNavigation';

jest.mock('../lib/navigation', () => ({
  navigatePush: jest.fn(),
}));

const isTimerNeverExpired = (): boolean => false;
const isTimerAlwaysExpired = (): boolean => true;

const everyCandidateHasTodoByHumanItems: Record<string, number> = {
  acme: 1,
  beta: 1,
  gamma: 1,
  'no-timer': 1,
};
const noCandidateHasAwaitingOwnerItems: Record<string, number> = {};

const defaultArgs = {
  timerMode: true,
  isTimerExpired: isTimerNeverExpired,
  prsCount: 0,
  todoByHumanCount: 0,
  pjcode: 'acme' as string | null,
  pjcodes: ['acme', 'beta'],
  projectMinutes: { acme: 30, beta: 30 },
  prsSnapshotLoaded: true,
  todoByHumanSnapshotLoaded: true,
  prsSnapshotFromCache: false,
  todoByHumanSnapshotFromCache: false,
  explicitlySelectedPjcode: null as string | null,
  enqueueSequence: 0,
  dialogOpen: false,
  projectTodoByHumanCounts: everyCandidateHasTodoByHumanItems,
  projectAwaitingOwnerCounts: noCandidateHasAwaitingOwnerItems,
};

describe('useConsoleAutomaticProjectNavigation', () => {
  beforeEach(() => {
    (navigatePush as jest.Mock).mockClear();
  });

  it('navigates to next project when prs and todo-by-human are both zero on arrival', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        null,
        false,
        defaultArgs.projectTodoByHumanCounts,
        defaultArgs.projectAwaitingOwnerCounts,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when timer mode is off', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        false,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs count is greater than zero', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        1,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human count is greater than zero', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        1,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        false,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is not yet loaded', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        false,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when prs snapshot is from cache', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        true,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when todo-by-human snapshot is from cache', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        true,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when no other project has minutes configured', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme'],
        { acme: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when pjcode is null', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        null,
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not re-navigate for the same pjcode on re-render', () => {
    const { rerender } = renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    rerender();
    expect(navigatePush).toHaveBeenCalledTimes(1);
  });

  it('stops skipping after all projects with minutes are exhausted', () => {
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('never oscillates back and forth between two projects that both keep nonzero remaining minutes forever, across many periodic re-evaluations with nothing else changing', () => {
    const navigatePushMock = navigatePush as jest.Mock;
    const extractPjcodeFromNavigatedUrl = (url: string): string =>
      url.split('/')[2];
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcode: 'acme' } },
    );

    let currentPjcode = 'acme';
    for (
      let periodicReEvaluation = 0;
      periodicReEvaluation < 20;
      periodicReEvaluation++
    ) {
      if (navigatePushMock.mock.calls.length > 0) {
        const lastCall =
          navigatePushMock.mock.calls[navigatePushMock.mock.calls.length - 1];
        currentPjcode = extractPjcodeFromNavigatedUrl(lastCall[0] as string);
      }
      rerender({ pjcode: currentPjcode });
    }

    expect(navigatePushMock.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('resets skip counter and navigates again when arriving at a project with items', () => {
    const { rerender } = renderHook(
      ({ pjcode, prsCount }: { pjcode: string; prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          pjcode,
          ['acme', 'beta', 'gamma'],
          { acme: 30, beta: 30, gamma: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcode: 'acme', prsCount: 0 } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta', prsCount: 1 });
    expect(navigatePush).not.toHaveBeenCalled();
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'gamma', prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/acme/todo-by-human');
  });

  it('navigates to next project including unconfigured ones that use DEFAULT_TIMER_MINUTES', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'no-timer', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith(
      '/projects/no-timer/todo-by-human',
    );
  });

  it('completes full skip cycle through unconfigured projects', () => {
    const { rerender } = renderHook(
      ({ pjcode }: { pjcode: string }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          pjcode,
          ['acme', 'no-timer', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcode: 'acme' } },
    );
    expect(navigatePush).toHaveBeenCalledWith(
      '/projects/no-timer/todo-by-human',
    );
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'no-timer' });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta' });
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates when pjcodes loads after snapshots (race condition)', () => {
    const { rerender } = renderHook(
      ({ pjcodes }: { pjcodes: string[] }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          'beta',
          pjcodes,
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcodes: [] as string[] } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ pjcodes: ['acme', 'beta'] });
    expect(navigatePush).toHaveBeenCalledWith('/projects/acme/todo-by-human');
  });

  it('navigates to next project when counts drop to zero from non-zero while already on a project', () => {
    const { rerender } = renderHook(
      ({ prsCount }: { prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { prsCount: 1 } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates to next project when todo-by-human count drops to zero from non-zero while already on a project', () => {
    const { rerender } = renderHook(
      ({ todoByHumanCount }: { todoByHumanCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          todoByHumanCount,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { todoByHumanCount: 3 } },
    );
    expect(navigatePush).not.toHaveBeenCalled();

    rerender({ todoByHumanCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates from a previously-skipped project when returning after visiting a project with tasks', () => {
    const { rerender } = renderHook(
      ({ pjcode, prsCount }: { pjcode: string; prsCount: number }) =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          prsCount,
          0,
          pjcode,
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      { initialProps: { pjcode: 'acme', prsCount: 0 } },
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'beta', prsCount: 1 });
    expect(navigatePush).not.toHaveBeenCalled();
    (navigatePush as jest.Mock).mockClear();

    rerender({ pjcode: 'acme', prsCount: 0 });
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when explicitlySelectedPjcode matches current pjcode', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        'acme',
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when explicitlySelectedPjcode matches current pjcode and no other project has remaining minutes', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 0 },
        true,
        true,
        false,
        false,
        'acme',
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates when explicitlySelectedPjcode is null', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        null,
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('navigates when explicitlySelectedPjcode is set to a different project than current pjcode', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        true,
        isTimerNeverExpired,
        0,
        0,
        'acme',
        ['acme', 'beta'],
        { acme: 30, beta: 30 },
        true,
        true,
        false,
        false,
        'beta',
        0,
        null,
        false,
        everyCandidateHasTodoByHumanItems,
        noCandidateHasAwaitingOwnerItems,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  it('does not navigate when the user has a task open, even when prs and todo-by-human are both zero (#32963)', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        'some-task-item-key',
        false,
        defaultArgs.projectTodoByHumanCounts,
        defaultArgs.projectAwaitingOwnerCounts,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('does not navigate when the task-creation dialog is open, even when prs and todo-by-human are both zero (#3491)', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        null,
        true,
        defaultArgs.projectTodoByHumanCounts,
        defaultArgs.projectAwaitingOwnerCounts,
      ),
    );
    expect(navigatePush).not.toHaveBeenCalled();
  });

  it('navigates normally when the task-creation dialog is closed (dialogOpen=false), confirming the dialog guard does not suppress the default remaining-count-zero switch (#3491)', () => {
    renderHook(() =>
      useConsoleAutomaticProjectNavigation(
        defaultArgs.timerMode,
        defaultArgs.isTimerExpired,
        defaultArgs.prsCount,
        defaultArgs.todoByHumanCount,
        defaultArgs.pjcode,
        defaultArgs.pjcodes,
        defaultArgs.projectMinutes,
        defaultArgs.prsSnapshotLoaded,
        defaultArgs.todoByHumanSnapshotLoaded,
        defaultArgs.prsSnapshotFromCache,
        defaultArgs.todoByHumanSnapshotFromCache,
        defaultArgs.explicitlySelectedPjcode,
        defaultArgs.enqueueSequence,
        null,
        defaultArgs.dialogOpen,
        defaultArgs.projectTodoByHumanCounts,
        defaultArgs.projectAwaitingOwnerCounts,
      ),
    );
    expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
  });

  describe('a candidate project is a navigation target only when it has an actionable item count', () => {
    type ActionableCountsScenario = {
      name: string;
      isTimerExpired: (minutes: number) => boolean;
      prsCount: number;
      todoByHumanCount: number;
      pjcode: string;
      pjcodes: string[];
      projectMinutes: Record<string, number>;
      enqueueSequence: number;
      projectTodoByHumanCounts: Record<string, number>;
      projectAwaitingOwnerCounts: Record<string, number>;
      expectedNavigations: string[];
    };

    const rotationScenario: ActionableCountsScenario = {
      name: '',
      isTimerExpired: isTimerNeverExpired,
      prsCount: 0,
      todoByHumanCount: 0,
      pjcode: 'acme',
      pjcodes: ['acme', 'beta'],
      projectMinutes: { acme: 30, beta: 30 },
      enqueueSequence: 0,
      projectTodoByHumanCounts: {},
      projectAwaitingOwnerCounts: {},
      expectedNavigations: [],
    };

    const timerElapsedScenario: ActionableCountsScenario = {
      ...rotationScenario,
      isTimerExpired: isTimerAlwaysExpired,
      prsCount: 1,
      todoByHumanCount: 1,
      enqueueSequence: 1,
    };

    const navigationsFor = (scenario: ActionableCountsScenario): string[] => {
      (navigatePush as jest.Mock).mockClear();
      const { unmount } = renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          scenario.isTimerExpired,
          scenario.prsCount,
          scenario.todoByHumanCount,
          scenario.pjcode,
          scenario.pjcodes,
          scenario.projectMinutes,
          true,
          true,
          false,
          false,
          null,
          scenario.enqueueSequence,
          null,
          false,
          scenario.projectTodoByHumanCounts,
          scenario.projectAwaitingOwnerCounts,
        ),
      );
      const navigations = (navigatePush as jest.Mock).mock.calls.map(
        (call: unknown[]) => String(call[0]),
      );
      unmount();
      return navigations;
    };

    const expectNavigationsToMatchScenarios = (
      scenarios: ActionableCountsScenario[],
    ): void => {
      const actual = scenarios.map((scenario) => ({
        name: scenario.name,
        navigations: navigationsFor(scenario),
      }));

      expect(actual).toEqual(
        scenarios.map((scenario) => ({
          name: scenario.name,
          navigations: scenario.expectedNavigations,
        })),
      );
    };

    it('navigates to a candidate that has a positive todo-by-human count, whether the switch comes from the remaining-count-zero rotation or from the elapsed timer', () => {
      expectNavigationsToMatchScenarios([
        {
          ...rotationScenario,
          name: 'rotation: candidate with only a positive todo-by-human count',
          projectTodoByHumanCounts: { beta: 2 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: candidate with both counts positive',
          projectTodoByHumanCounts: { beta: 3 },
          projectAwaitingOwnerCounts: { beta: 4 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: first candidate has zero counts and the second has a positive count',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { beta: 0, gamma: 1 },
          expectedNavigations: ['/projects/gamma/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: the only eligible candidate, holding a todo-by-human count, sits before the current project in the list',
          pjcode: 'gamma',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { acme: 1 },
          expectedNavigations: ['/projects/acme/todo-by-human'],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: candidate with only a positive todo-by-human count',
          projectTodoByHumanCounts: { beta: 1 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: first candidate has zero counts and the second has a positive todo-by-human count',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { beta: 0, gamma: 1 },
          expectedNavigations: ['/projects/gamma/todo-by-human'],
        },
      ]);
    });

    it('navigates to a candidate whose only positive count is the awaiting-owner count, whether the switch comes from the remaining-count-zero rotation or from the elapsed timer', () => {
      expectNavigationsToMatchScenarios([
        {
          ...rotationScenario,
          name: 'rotation: candidate with only a positive awaiting-owner count',
          projectAwaitingOwnerCounts: { beta: 1 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: two eligible candidates, the first in rotation order wins whichever count kind it has',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { gamma: 2 },
          projectAwaitingOwnerCounts: { beta: 1 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: the only eligible candidate, holding an awaiting-owner count, sits before the current project in the list',
          pjcode: 'gamma',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectAwaitingOwnerCounts: { acme: 1 },
          expectedNavigations: ['/projects/acme/todo-by-human'],
        },
        {
          ...rotationScenario,
          name: 'rotation: first candidate has zero counts and the second has only a positive awaiting-owner count',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { beta: 0, gamma: 0 },
          projectAwaitingOwnerCounts: { beta: 0, gamma: 1 },
          expectedNavigations: ['/projects/gamma/todo-by-human'],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: candidate with only a positive awaiting-owner count',
          projectAwaitingOwnerCounts: { beta: 3 },
          expectedNavigations: ['/projects/beta/todo-by-human'],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: first candidate has zero counts and the second has only a positive awaiting-owner count',
          pjcodes: ['acme', 'beta', 'gamma'],
          projectMinutes: { acme: 30, beta: 30, gamma: 30 },
          projectTodoByHumanCounts: { beta: 0, gamma: 0 },
          projectAwaitingOwnerCounts: { beta: 0, gamma: 2 },
          expectedNavigations: ['/projects/gamma/todo-by-human'],
        },
      ]);
    });

    it('does not navigate when no candidate has a positive count or minutes, whether the switch would come from the remaining-count-zero rotation or from the elapsed timer', () => {
      expectNavigationsToMatchScenarios([
        {
          ...rotationScenario,
          name: 'rotation: candidate with both counts explicitly zero',
          projectTodoByHumanCounts: { beta: 0 },
          projectAwaitingOwnerCounts: { beta: 0 },
          expectedNavigations: [],
        },
        {
          ...rotationScenario,
          name: 'rotation: no counts supplied for any project',
          expectedNavigations: [],
        },
        {
          ...rotationScenario,
          name: 'rotation: only the current project has positive counts',
          projectTodoByHumanCounts: { acme: 5 },
          projectAwaitingOwnerCounts: { acme: 5 },
          expectedNavigations: [],
        },
        {
          ...rotationScenario,
          name: 'rotation: candidate has positive counts but zero minutes',
          projectMinutes: { acme: 30, beta: 0 },
          projectTodoByHumanCounts: { beta: 2 },
          projectAwaitingOwnerCounts: { beta: 2 },
          expectedNavigations: [],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: candidate with both counts zero',
          projectTodoByHumanCounts: { beta: 0 },
          projectAwaitingOwnerCounts: { beta: 0 },
          expectedNavigations: [],
        },
        {
          ...timerElapsedScenario,
          name: 'timer elapsed: no counts supplied for any project',
          expectedNavigations: [],
        },
      ]);
    });

    it('does not rotate into a project without actionable items while cycling through the other projects', () => {
      const { rerender } = renderHook(
        ({ pjcode }: { pjcode: string }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerNeverExpired,
            0,
            0,
            pjcode,
            ['acme', 'beta', 'gamma'],
            { acme: 30, beta: 30, gamma: 30 },
            true,
            true,
            false,
            false,
            null,
            0,
            null,
            false,
            { beta: 1, gamma: 0 },
            { gamma: 0 },
          ),
        { initialProps: { pjcode: 'acme' } },
      );
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        ['/projects/beta/todo-by-human'],
      ]);
      (navigatePush as jest.Mock).mockClear();

      rerender({ pjcode: 'beta' });
      expect(navigatePush).not.toHaveBeenCalled();
    });
  });

  describe('enqueueSequence drives navigation evaluation with no write-confirmation wait', () => {
    it('navigates via the timer-elapsed path as soon as enqueueSequence reflects a newly enqueued action, on the very first render, with no later render standing in for write confirmation', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          1,
          1,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      );
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });

    it('does not navigate via the timer-elapsed path when the timer has elapsed but enqueueSequence has not changed since the last evaluation', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
            false,
            everyCandidateHasTodoByHumanItems,
            noCandidateHasAwaitingOwnerItems,
          ),
        { initialProps: { enqueueSequence: 0 } },
      );
      expect(navigatePush).not.toHaveBeenCalled();

      rerender({ enqueueSequence: 0 });
      expect(navigatePush).not.toHaveBeenCalled();
    });

    it('does not navigate again on a second render with the same enqueueSequence (dedup)', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
            false,
            everyCandidateHasTodoByHumanItems,
            noCandidateHasAwaitingOwnerItems,
          ),
        { initialProps: { enqueueSequence: 1 } },
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');

      rerender({ enqueueSequence: 1 });
      expect(navigatePush).toHaveBeenCalledTimes(1);
    });

    it('navigates again once a new enqueueSequence arrives after a prior one was already handled', () => {
      const { rerender } = renderHook(
        ({ enqueueSequence }: { enqueueSequence: number }) =>
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            'acme',
            ['acme', 'beta'],
            { acme: 30, beta: 30 },
            true,
            true,
            false,
            false,
            null,
            enqueueSequence,
            null,
            false,
            everyCandidateHasTodoByHumanItems,
            noCandidateHasAwaitingOwnerItems,
          ),
        { initialProps: { enqueueSequence: 1 } },
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);

      rerender({ enqueueSequence: 1 });
      expect(navigatePush).toHaveBeenCalledTimes(1);

      rerender({ enqueueSequence: 2 });
      expect(navigatePush).toHaveBeenCalledTimes(2);
    });

    it('navigates via the timer-elapsed path even while a task is open, because taskOpen does not suppress this path', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          1,
          1,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          'some-task-item-key',
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      );
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });

    it('navigates via the timer-elapsed path even while the task-creation dialog is open, because dialogOpen does not suppress this path (#3491)', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          1,
          1,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          null,
          true,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      );
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });

    it('does not navigate via the remaining-count-zero rotation path when the task-creation dialog is open and no action was newly enqueued (#3491)', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerNeverExpired,
          0,
          0,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          0,
          null,
          true,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      );
      expect(navigatePush).not.toHaveBeenCalled();
    });

    it('navigates exactly once to the next project when both the timer-elapsed and remaining-count-zero conditions hold for the same newly enqueued action', () => {
      renderHook(() =>
        useConsoleAutomaticProjectNavigation(
          true,
          isTimerAlwaysExpired,
          0,
          0,
          'acme',
          ['acme', 'beta'],
          { acme: 30, beta: 30 },
          true,
          true,
          false,
          false,
          null,
          1,
          null,
          false,
          everyCandidateHasTodoByHumanItems,
          noCandidateHasAwaitingOwnerItems,
        ),
      );
      expect(navigatePush).toHaveBeenCalledTimes(1);
      expect(navigatePush).toHaveBeenCalledWith('/projects/beta/todo-by-human');
    });
  });

  describe('the automatic project switch made for a newly enqueued action stays in place whatever the outcome of that action write', () => {
    const pjcodesWithTimers = ['acme', 'beta'];
    const projectMinutesByPjcode = { acme: 30, beta: 30 };
    const switchedToBetaUrl = '/projects/beta/todo-by-human';
    const approvedActionMessage = 'Approved — PR #851';

    const approveReviewOfflinePayload = {
      itemUrl: 'https://github.com/o/r/pull/851',
      projectItemId: 'PVTI_1',
      itemNumber: 851,
      repo: 'o/r',
      nameWithOwner: 'o/r',
      isPr: true,
      apiPath: '/api/review',
      requestBody: {
        pjcode: 'acme',
        action: 'approve',
        prUrl: 'https://github.com/o/r/pull/851',
        projectItemId: 'PVTI_1',
      },
    };

    const flushMicrotasks = (): Promise<void> =>
      Promise.resolve().then(() => undefined);

    const renderActionQueueWithAutomaticProjectNavigation = () =>
      renderHook(
        ({ pjcode }: { pjcode: string }) => {
          const actionQueue = useConsoleActionQueue();
          useConsoleAutomaticProjectNavigation(
            true,
            isTimerAlwaysExpired,
            1,
            1,
            pjcode,
            pjcodesWithTimers,
            projectMinutesByPjcode,
            true,
            true,
            false,
            false,
            null,
            actionQueue.enqueueSequence,
            null,
            false,
            everyCandidateHasTodoByHumanItems,
            noCandidateHasAwaitingOwnerItems,
          );
          return actionQueue;
        },
        { initialProps: { pjcode: 'acme' } },
      );

    beforeEach(() => {
      jest.useFakeTimers();
      localStorage.clear();
    });

    afterEach(() => {
      jest.useRealTimers();
      localStorage.clear();
    });

    it('does not revert the switch and keeps the same error content and a working retry when the write is confirmed failed', async () => {
      const { result, rerender } =
        renderActionQueueWithAutomaticProjectNavigation();
      expect(navigatePush).not.toHaveBeenCalled();

      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValueOnce(new Error('HTTP 422 review cannot be requested'))
        .mockRejectedValueOnce(new Error('HTTP 500 internal server error'));
      const revertAdvance = jest.fn();
      const revertOptimistic = jest.fn();
      act(() => {
        result.current.enqueue({
          message: approvedActionMessage,
          color: 'green',
          commit,
          advance: jest.fn(),
          revertAdvance,
          optimistic: jest.fn(),
          revertOptimistic,
        });
      });
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      rerender({ pjcode: 'beta' });
      await act(async () => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS);
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0]]);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 1,
      });
      expect(result.current.error).toEqual([
        {
          id: expect.any(String),
          createdAt: expect.any(Number),
          message: approvedActionMessage,
          reason: 'HTTP 422 review cannot be requested',
          retry: expect.any(Function),
        },
      ]);
      expect(result.current.offlineActions).toEqual([]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      const retry = result.current.error[0]?.retry;
      await act(async () => {
        retry?.();
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0], [0]]);
      expect(result.current.writeState).toEqual({
        status: 'failed',
        attempt: 2,
      });
      expect(result.current.error).toEqual([
        {
          id: expect.any(String),
          createdAt: expect.any(Number),
          message: approvedActionMessage,
          reason: 'HTTP 500 internal server error',
          retry: expect.any(Function),
        },
      ]);
      expect(result.current.offlineActions).toEqual([]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);
    });

    it('does not revert the switch and keeps the same offline-pending entry when the write is queued offline after a network error', async () => {
      const { result, rerender } =
        renderActionQueueWithAutomaticProjectNavigation();
      expect(navigatePush).not.toHaveBeenCalled();

      const commit = jest
        .fn<Promise<void>, [number]>()
        .mockRejectedValue(new TypeError('Failed to fetch'));
      const revertAdvance = jest.fn();
      const revertOptimistic = jest.fn();
      act(() => {
        result.current.enqueue({
          message: approvedActionMessage,
          color: 'green',
          commit,
          advance: jest.fn(),
          revertAdvance,
          optimistic: jest.fn(),
          revertOptimistic,
          offline: [approveReviewOfflinePayload],
        });
      });
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      rerender({ pjcode: 'beta' });
      await act(async () => {
        jest.advanceTimersByTime(ACTION_TOAST_DELAY_MS);
        await flushMicrotasks();
      });

      expect(commit.mock.calls).toEqual([[0]]);
      expect(result.current.writeState).toEqual({
        status: 'offline',
        attempt: 1,
      });
      expect(result.current.error).toEqual([]);
      expect(result.current.offlineActions).toEqual([
        {
          ...approveReviewOfflinePayload,
          id: expect.any(String),
          message: approvedActionMessage,
          color: 'green',
          enqueuedAt: expect.any(Number),
        },
      ]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);

      const heldActionId = result.current.offlineActions[0].id;
      act(() => {
        result.current.discardOfflineAction(heldActionId);
      });

      expect(result.current.offlineActions).toEqual([]);
      expect(result.current.error).toEqual([]);
      expect(revertAdvance).not.toHaveBeenCalled();
      expect(revertOptimistic).not.toHaveBeenCalled();
      expect((navigatePush as jest.Mock).mock.calls).toEqual([
        [switchedToBetaUrl],
      ]);
    });
  });
});
