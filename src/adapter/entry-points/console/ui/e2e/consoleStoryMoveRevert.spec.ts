import { expect, type Page, test } from '@playwright/test';
import {
  CONSOLE_E2E_PJCODE,
  CONSOLE_E2E_REPO_NAME_WITH_OWNER,
  CONSOLE_E2E_STORY_MOVE_TASK_TITLES,
  type ConsoleE2eHarness,
  type ConsoleE2eStoryPlacement,
  startConsoleE2eHarness,
  writeConsoleE2eStoriesSnapshot,
} from './consoleTestHarness';

const TDPM_CONSOLE_PORT = {
  name: 'TDPM Console port',
  optionId: '1491051e',
};
const PUBLISH_PRODUCT_DOCS = {
  name: 'Publish product documentation site',
  optionId: 'f7cd5cbc',
};
const WORKFLOW_BLOCKER = {
  name: 'regular / WORKFLOW BLOCKER',
  optionId: 'a3b9c4d2',
};
const STORY_GROUPS = [
  TDPM_CONSOLE_PORT,
  PUBLISH_PRODUCT_DOCS,
  WORKFLOW_BLOCKER,
];

const TASK_ONE = 921;
const TASK_TWO = 922;
const TASK_THREE = 923;
const TASK_FOUR = 924;

const INITIAL_GENERATED_AT = '2026-06-18T01:22:09Z';

const FIVE_MINUTES_MS = 5 * 60_000;
const OLDER_LIST_MIN_AGE_MS = 30_000;
const NEWER_LIST_MIN_AGE_MS = 2_000;

const wholeSecondAtOrBefore = (ms: number): string =>
  new Date(Math.floor(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

const wholeSecondAtOrAfter = (ms: number): string =>
  new Date(Math.ceil(ms / 1000) * 1000).toISOString().replace('.000Z', 'Z');

const BROWSER_CLOCK_CASES = [
  { label: 'matches the server clock', offsetMs: 0 },
  { label: 'is 5 minutes behind the server clock', offsetMs: -FIVE_MINUTES_MS },
  {
    label: 'is 5 minutes ahead of the server clock',
    offsetMs: FIVE_MINUTES_MS,
  },
];

const ALL_TASKS_IN_TDPM: ConsoleE2eStoryPlacement[] = [
  TASK_ONE,
  TASK_TWO,
  TASK_THREE,
  TASK_FOUR,
].map((issueNumber) => ({
  issueNumber,
  storyOptionId: TDPM_CONSOLE_PORT.optionId,
}));

const MOVED_PLACEMENTS: ConsoleE2eStoryPlacement[] = [
  { issueNumber: TASK_ONE, storyOptionId: PUBLISH_PRODUCT_DOCS.optionId },
  { issueNumber: TASK_TWO, storyOptionId: WORKFLOW_BLOCKER.optionId },
  { issueNumber: TASK_THREE, storyOptionId: PUBLISH_PRODUCT_DOCS.optionId },
  { issueNumber: TASK_FOUR, storyOptionId: TDPM_CONSOLE_PORT.optionId },
];

const CHANGED_ELSEWHERE_PLACEMENTS: ConsoleE2eStoryPlacement[] = [
  { issueNumber: TASK_ONE, storyOptionId: WORKFLOW_BLOCKER.optionId },
  { issueNumber: TASK_TWO, storyOptionId: WORKFLOW_BLOCKER.optionId },
  { issueNumber: TASK_THREE, storyOptionId: PUBLISH_PRODUCT_DOCS.optionId },
  { issueNumber: TASK_FOUR, storyOptionId: TDPM_CONSOLE_PORT.optionId },
];

const MOVES: { issueNumber: number; target: (typeof STORY_GROUPS)[number] }[] =
  [
    { issueNumber: TASK_ONE, target: PUBLISH_PRODUCT_DOCS },
    { issueNumber: TASK_TWO, target: WORKFLOW_BLOCKER },
    { issueNumber: TASK_THREE, target: PUBLISH_PRODUCT_DOCS },
  ];

const tabByLabel = (page: Page, label: string) =>
  page.locator('.console-tab', { hasText: label });

const activeTabLabel = (page: Page) =>
  page.locator('.console-tab[data-active="true"] .console-tab-label');

const storyRow = (page: Page, storyName: string) =>
  page.locator('.console-story-list-row').filter({
    has: page.locator(
      '.console-story-list-row-main > .console-story-name-toggle',
      {
        hasText: storyName,
      },
    ),
  });

const openStoryTasks = async (page: Page, storyName: string): Promise<void> => {
  const row = storyRow(page, storyName);
  const chevron = row.getByRole('button', { name: /^(Show|Hide) tasks$/ });
  await expect(chevron).toBeVisible();
  if ((await chevron.getAttribute('aria-label')) === 'Show tasks') {
    await chevron.click();
  }
  await expect(row.getByRole('button', { name: 'Hide tasks' })).toBeVisible();
};

const expectStoryTaskNumbers = async (
  page: Page,
  storyName: string,
  issueNumbers: number[],
): Promise<void> => {
  await openStoryTasks(page, storyName);
  const expectedTitles = issueNumbers
    .map((issueNumber) => CONSOLE_E2E_STORY_MOVE_TASK_TITLES[issueNumber])
    .sort();
  await expect
    .poll(async () =>
      (
        await storyRow(page, storyName)
          .locator('.console-story-task-title')
          .allTextContents()
      ).sort(),
    )
    .toEqual(expectedTitles);
};

const expectStoryPlacement = async (
  page: Page,
  placements: ConsoleE2eStoryPlacement[],
): Promise<void> => {
  for (const group of STORY_GROUPS) {
    const issueNumbers = placements
      .filter((placement) => placement.storyOptionId === group.optionId)
      .map((placement) => placement.issueNumber);
    await expectStoryTaskNumbers(page, group.name, issueNumbers);
  }
};

const refreshStoriesList = async (page: Page): Promise<void> => {
  const storiesListResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(`/projects/${CONSOLE_E2E_PJCODE}/stories/list.json`),
  );
  await page.clock.fastForward(60_000);
  await storiesListResponse;
};

const moveTaskToStory = async (
  page: Page,
  storyHarness: ConsoleE2eHarness,
  issueNumber: number,
  target: (typeof STORY_GROUPS)[number],
  expectedSetStoryCallCount: number,
): Promise<void> => {
  await openStoryTasks(page, TDPM_CONSOLE_PORT.name);
  const taskRow = storyRow(page, TDPM_CONSOLE_PORT.name).locator(
    '.console-story-task-row',
    { hasText: CONSOLE_E2E_STORY_MOVE_TASK_TITLES[issueNumber] },
  );
  await taskRow
    .getByRole('combobox', { name: 'Set story' })
    .selectOption(target.optionId);
  await expect
    .poll(() => storyHarness.setStoryCalls.length)
    .toBe(expectedSetStoryCallCount);
  await openStoryTasks(page, target.name);
  await expect(
    storyRow(page, target.name).locator('.console-story-task-title', {
      hasText: CONSOLE_E2E_STORY_MOVE_TASK_TITLES[issueNumber],
    }),
  ).toHaveCount(1);
};

const performMoves = async (
  page: Page,
  storyHarness: ConsoleE2eHarness,
): Promise<{ firstMoveStartedMs: number; lastSetStoryObservedMs: number }> => {
  const firstMoveStartedMs = Date.now();
  for (const [index, move] of MOVES.entries()) {
    await moveTaskToStory(
      page,
      storyHarness,
      move.issueNumber,
      move.target,
      index + 1,
    );
  }
  await expect
    .poll(() => storyHarness.setStoryCalls)
    .toEqual([
      {
        issueUrl: `https://github.com/${CONSOLE_E2E_REPO_NAME_WITH_OWNER}/issues/${TASK_ONE}`,
        storyOptionId: PUBLISH_PRODUCT_DOCS.optionId,
      },
      {
        issueUrl: `https://github.com/${CONSOLE_E2E_REPO_NAME_WITH_OWNER}/issues/${TASK_TWO}`,
        storyOptionId: WORKFLOW_BLOCKER.optionId,
      },
      {
        issueUrl: `https://github.com/${CONSOLE_E2E_REPO_NAME_WITH_OWNER}/issues/${TASK_THREE}`,
        storyOptionId: PUBLISH_PRODUCT_DOCS.optionId,
      },
    ]);
  await expectStoryPlacement(page, MOVED_PLACEMENTS);
  const lastSetStoryObservedMs = Date.now();
  return { firstMoveStartedMs, lastSetStoryObservedMs };
};

const runMoveThenListSequence = async (
  page: Page,
  storyHarness: ConsoleE2eHarness,
  offsetMs: number,
  newerPlacements: ConsoleE2eStoryPlacement[],
  olderListFirst: boolean,
): Promise<void> => {
  writeConsoleE2eStoriesSnapshot(
    storyHarness.consoleDataOutputDir,
    INITIAL_GENERATED_AT,
    ALL_TASKS_IN_TDPM,
  );
  await page.clock.install({ time: new Date(Date.now() + offsetMs) });
  await page.goto(storyHarness.appRootUrl);
  await tabByLabel(page, 'Stories').click();
  await expect(activeTabLabel(page)).toHaveText('Stories');
  await expectStoryPlacement(page, ALL_TASKS_IN_TDPM);

  const { firstMoveStartedMs, lastSetStoryObservedMs } = await performMoves(
    page,
    storyHarness,
  );

  if (olderListFirst) {
    writeConsoleE2eStoriesSnapshot(
      storyHarness.consoleDataOutputDir,
      wholeSecondAtOrBefore(firstMoveStartedMs - OLDER_LIST_MIN_AGE_MS),
      ALL_TASKS_IN_TDPM,
    );
    await refreshStoriesList(page);
    await expectStoryPlacement(page, MOVED_PLACEMENTS);
  }

  writeConsoleE2eStoriesSnapshot(
    storyHarness.consoleDataOutputDir,
    wholeSecondAtOrAfter(lastSetStoryObservedMs + NEWER_LIST_MIN_AGE_MS),
    newerPlacements,
  );
  await refreshStoriesList(page);
  await expectStoryPlacement(page, newerPlacements);
};

const runNewerThenOlderListSequence = async (
  page: Page,
  storyHarness: ConsoleE2eHarness,
  offsetMs: number,
): Promise<void> => {
  writeConsoleE2eStoriesSnapshot(
    storyHarness.consoleDataOutputDir,
    INITIAL_GENERATED_AT,
    ALL_TASKS_IN_TDPM,
  );
  await page.clock.install({ time: new Date(Date.now() + offsetMs) });
  await page.goto(storyHarness.appRootUrl);
  await tabByLabel(page, 'Stories').click();
  await expect(activeTabLabel(page)).toHaveText('Stories');
  await expectStoryPlacement(page, ALL_TASKS_IN_TDPM);

  const { firstMoveStartedMs, lastSetStoryObservedMs } = await performMoves(
    page,
    storyHarness,
  );

  writeConsoleE2eStoriesSnapshot(
    storyHarness.consoleDataOutputDir,
    wholeSecondAtOrAfter(lastSetStoryObservedMs + NEWER_LIST_MIN_AGE_MS),
    MOVED_PLACEMENTS,
  );
  await refreshStoriesList(page);
  await expectStoryPlacement(page, MOVED_PLACEMENTS);

  writeConsoleE2eStoriesSnapshot(
    storyHarness.consoleDataOutputDir,
    wholeSecondAtOrBefore(firstMoveStartedMs - OLDER_LIST_MIN_AGE_MS),
    ALL_TASKS_IN_TDPM,
  );
  await refreshStoriesList(page);
  await expectStoryPlacement(page, MOVED_PLACEMENTS);
};

for (const clockCase of BROWSER_CLOCK_CASES) {
  test(`keeps story moves under the chosen stories through an older list and then a newer list when the browser clock ${clockCase.label}`, async ({
    page,
  }) => {
    const storyHarness = await startConsoleE2eHarness();
    try {
      await runMoveThenListSequence(
        page,
        storyHarness,
        clockCase.offsetMs,
        MOVED_PLACEMENTS,
        true,
      );
    } finally {
      await storyHarness.stop();
    }
  });

  test(`shows the story from a newer list for a task changed elsewhere after the move when the browser clock ${clockCase.label}`, async ({
    page,
  }) => {
    const storyHarness = await startConsoleE2eHarness();
    try {
      await runMoveThenListSequence(
        page,
        storyHarness,
        clockCase.offsetMs,
        CHANGED_ELSEWHERE_PLACEMENTS,
        true,
      );
    } finally {
      await storyHarness.stop();
    }
  });

  test(`shows the story from a newer list for a task changed elsewhere directly after the move when the browser clock ${clockCase.label}`, async ({
    page,
  }) => {
    const storyHarness = await startConsoleE2eHarness();
    try {
      await runMoveThenListSequence(
        page,
        storyHarness,
        clockCase.offsetMs,
        CHANGED_ELSEWHERE_PLACEMENTS,
        false,
      );
    } finally {
      await storyHarness.stop();
    }
  });
  test(`keeps every moved task under its chosen story when a newer list is applied before an older list when the browser clock ${clockCase.label}`, async ({
    page,
  }) => {
    const storyHarness = await startConsoleE2eHarness();
    try {
      await runNewerThenOlderListSequence(
        page,
        storyHarness,
        clockCase.offsetMs,
      );
    } finally {
      await storyHarness.stop();
    }
  });
}
