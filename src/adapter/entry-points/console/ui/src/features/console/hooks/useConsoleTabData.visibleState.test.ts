import { CONSOLE_TABS } from '../logic/types';
import {
  applyTabSnapshotToVisibleState,
  type ConsoleTabDataVisibleState,
  type ConsoleTabSnapshot,
} from './useConsoleTabData';

const makeSnapshot = (generatedAt: string): ConsoleTabSnapshot => ({
  items: [],
  generatedAt,
  statusOptions: [],
  agentOptions: [],
  storyOptions: [],
  storyColors: {},
  stories: [],
  defaultNameWithOwner: null,
  fromCache: false,
  storyOrder: [],
  timerEndsAt: null,
  timerTotalSeconds: null,
});

const makeVisibleState = (
  pjcode: string | null,
  generatedAt: string | null,
): ConsoleTabDataVisibleState => {
  const snapshots = Object.fromEntries(
    CONSOLE_TABS.map((tab) => [tab.name, null]),
  ) as ConsoleTabDataVisibleState['snapshots'];
  if (generatedAt !== null) {
    snapshots.queued = makeSnapshot(generatedAt);
  }
  return { pjcode, snapshots };
};

describe('applyTabSnapshotToVisibleState', () => {
  it('replaces only the refreshed tab when the visible state belongs to the same project, and returns the visible state unchanged for any other project', () => {
    const refreshed = makeSnapshot('2026-07-01T00:00:00.000Z');
    const cases = [
      {
        name: 'same project',
        visible: makeVisibleState('acme', '2026-06-19T00:00:00.000Z'),
        pjcode: 'acme',
        expected: { pjcode: 'acme', queued: refreshed },
      },
      {
        name: 'another project is visible',
        visible: makeVisibleState('beta', '2026-06-25T00:00:00.000Z'),
        pjcode: 'acme',
        expected: 'unchanged',
      },
      {
        name: 'no project is visible',
        visible: makeVisibleState(null, null),
        pjcode: 'acme',
        expected: 'unchanged',
      },
    ] as const;

    for (const testCase of cases) {
      const next = applyTabSnapshotToVisibleState(
        testCase.visible,
        testCase.pjcode,
        'queued',
        refreshed,
      );
      if (testCase.expected === 'unchanged') {
        expect(next).toBe(testCase.visible);
        continue;
      }
      expect({ case: testCase.name, pjcode: next.pjcode }).toEqual({
        case: testCase.name,
        pjcode: testCase.expected.pjcode,
      });
      expect({ case: testCase.name, queued: next.snapshots.queued }).toEqual({
        case: testCase.name,
        queued: testCase.expected.queued,
      });
    }
  });
});
