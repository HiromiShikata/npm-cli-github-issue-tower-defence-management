import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import {
  type AirplaneItemSnapshot,
  type AirplaneSnapshot,
  type AirplaneTabSnapshot,
  clearAirplaneSnapshot,
  storeAirplaneSnapshot,
  writeAirplaneModeFlag,
} from '../lib/airplaneSnapshot';
import { ACTION_TOAST_DELAY_MS } from '../logic/actionToast';
import {
  CONSOLE_TABS,
  type ConsoleFieldOption,
  type ConsoleListItem,
  type ConsoleStoryEntry,
  type ConsoleTabName,
} from '../logic/types';
import {
  consoleListItemsFixture,
  consoleStatusOptionsFixture,
  consoleStoryColorsFixture,
  consoleStoryOptionsFixture,
} from '../testing/fixtures';
import { ConsolePage } from './ConsolePage';

const pullRequestItem: ConsoleListItem = {
  number: 851,
  title: 'Add serveConsole subcommand under entry-points',
  url: 'https://github.com/o/r/pull/851',
  repo: 'o/r',
  nameWithOwner: 'o/r',
  projectItemId: 'PVTI_851',
  itemId: 'PVTI_851',
  isPr: true,
  relatedOpenPullRequestUrls: [],
  story: 'TDPM Console port',
  status: 'Awaiting Owner',
  agent: null,
  nextActionDate: null,
  nextActionHour: null,
  dependedIssueUrls: [],
  labels: [],
  createdAt: '2026-06-17T00:00:00.000Z',
};

const emptyTabSnapshot: AirplaneTabSnapshot = {
  items: [],
  generatedAt: '2026-06-19T00:00:00.000Z',
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
};

const tabSnapshots: Record<ConsoleTabName, AirplaneTabSnapshot> = {
  'workflow-blocker': emptyTabSnapshot,
  prs: {
    ...emptyTabSnapshot,
    items: [pullRequestItem],
    statusOptions: [
      { id: 'status-aw', name: 'Awaiting Workspace', color: 'BLUE' },
    ],
    storyOptions: [
      { id: 'story-console', name: 'TDPM Console port', color: 'BLUE' },
    ],
    storyColors: { 'TDPM Console port': { color: 'BLUE' } },
    defaultNameWithOwner: 'o/r',
  },
  'failed-preparation': emptyTabSnapshot,
  'todo-by-human': emptyTabSnapshot,
  queued: emptyTabSnapshot,
  stories: emptyTabSnapshot,
};

const airplaneSnapshot: AirplaneSnapshot = {
  capturedAt: '2026-06-19T00:00:00.000Z',
  tabs: { acme: tabSnapshots },
  items: {
    [pullRequestItem.url]: {
      body: 'Adds the serveConsole subcommand under entry-points.',
      comments: [],
      state: {
        state: 'open',
        merged: false,
        isPullRequest: true,
        title: pullRequestItem.title,
        stateReason: '',
      },
      files: [],
      commits: [],
      prStatus: {
        found: true,
        isConflicted: false,
        mergeableStatus: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      },
      relatedPrs: [],
    },
  },
  failures: [],
};

const projectCode = 'acme';
const repositoryNameWithOwner =
  'HiromiShikata/npm-cli-github-issue-tower-defence-management';
const dependedIssueUrl =
  'https://github.com/HiromiShikata/npm-cli-github-issue-tower-defence-management/issues/778';
const PAGE_LOAD_TIMEOUT_MS = 5000;
const HELD_WRITE_TIMEOUT_MS = ACTION_TOAST_DELAY_MS + 3000;

const firstAwaitingOwnerItem: ConsoleListItem = consoleListItemsFixture[0];
const secondAwaitingOwnerItem: ConsoleListItem = {
  ...consoleListItemsFixture[2],
  status: 'Awaiting Owner',
};
const queuedItem: ConsoleListItem = {
  ...consoleListItemsFixture[5],
  status: 'Awaiting Workspace',
};
const storyTaskItem: ConsoleListItem = consoleListItemsFixture[2];
const storyEntry: ConsoleStoryEntry = {
  storyName: 'TDPM Console port',
  storyOptionId: '1491051e',
  color: 'BLUE',
  description: 'Rebuild the TDPM console UI with new story tab features.',
  openItemCount: 1,
  storyViewUrl: null,
  items: [storyTaskItem],
};

type PageScenario = {
  activeTab: ConsoleTabName;
  tabItems: Partial<Record<ConsoleTabName, ConsoleListItem[]>>;
  statusOptions: ConsoleFieldOption[];
  storyEntries: ConsoleStoryEntry[];
};

const awaitingOwnerScenario = (
  tabItems: PageScenario['tabItems'],
): PageScenario => ({
  activeTab: 'prs',
  tabItems,
  statusOptions: consoleStatusOptionsFixture,
  storyEntries: [],
});

const scenarioTabSnapshot = (
  scenario: PageScenario,
  tab: ConsoleTabName,
): AirplaneTabSnapshot => ({
  ...emptyTabSnapshot,
  items: scenario.tabItems[tab] ?? [],
  statusOptions: scenario.statusOptions,
  storyOptions: consoleStoryOptionsFixture,
  storyColors: consoleStoryColorsFixture,
  stories: tab === 'stories' ? scenario.storyEntries : [],
  defaultNameWithOwner: repositoryNameWithOwner,
});

const scenarioTabSnapshots = (
  scenario: PageScenario,
): Record<ConsoleTabName, AirplaneTabSnapshot> => ({
  'workflow-blocker': scenarioTabSnapshot(scenario, 'workflow-blocker'),
  prs: scenarioTabSnapshot(scenario, 'prs'),
  'failed-preparation': scenarioTabSnapshot(scenario, 'failed-preparation'),
  'todo-by-human': scenarioTabSnapshot(scenario, 'todo-by-human'),
  queued: scenarioTabSnapshot(scenario, 'queued'),
  stories: scenarioTabSnapshot(scenario, 'stories'),
});

const itemSnapshotOf = (item: ConsoleListItem): AirplaneItemSnapshot => ({
  body: `## Summary\n\n${item.title}.`,
  comments: [],
  state: {
    state: 'open',
    merged: false,
    isPullRequest: item.isPr,
    title: item.title,
    stateReason: '',
  },
  files: item.isPr ? [] : null,
  commits: item.isPr ? [] : null,
  prStatus: item.isPr
    ? {
        found: true,
        isConflicted: false,
        mergeableStatus: 'MERGEABLE',
        isPassedAllCiJob: true,
        isCiStateSuccess: true,
        isBranchOutOfDate: false,
        missingRequiredCheckNames: [],
      }
    : null,
  relatedPrs: [],
});

const scenarioItemSnapshots = (
  scenario: PageScenario,
): Record<string, AirplaneItemSnapshot> =>
  Object.fromEntries(
    [
      ...Object.values(scenario.tabItems).flatMap((items) => items ?? []),
      ...scenario.storyEntries.flatMap((entry) => entry.items),
    ].map((item) => [item.url, itemSnapshotOf(item)]),
  );

const scenarioAirplaneSnapshot = (
  scenario: PageScenario,
): AirplaneSnapshot => ({
  capturedAt: emptyTabSnapshot.generatedAt,
  tabs: { [projectCode]: scenarioTabSnapshots(scenario) },
  items: scenarioItemSnapshots(scenario),
  failures: [],
});

const jsonResponse = (payload: unknown, status: number = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const requestUrlOf = (input: RequestInfo | URL): URL =>
  new URL(
    input instanceof Request ? input.url : String(input),
    window.location.origin,
  );

const scenarioFetch =
  (
    scenario: PageScenario,
    writeResponse: () => Response,
    passthroughFetch: typeof window.fetch,
  ): typeof window.fetch =>
  async (input, init) => {
    const requestUrl = requestUrlOf(input);
    const isConsoleRequest =
      requestUrl.pathname.startsWith('/api/') ||
      requestUrl.pathname.startsWith('/projects/');
    if (!isConsoleRequest) {
      return passthroughFetch(input, init);
    }
    if (init?.method === 'POST') {
      return writeResponse();
    }
    const listMatch = requestUrl.pathname.match(
      /^\/projects\/[^/]+\/([^/]+)\/list\.json$/,
    );
    const listTab = CONSOLE_TABS.find((tab) => tab.name === listMatch?.[1]);
    if (listTab !== undefined) {
      return jsonResponse({
        pjcode: projectCode,
        ...scenarioTabSnapshot(scenario, listTab.name),
      });
    }
    const itemSnapshot: AirplaneItemSnapshot | undefined =
      scenarioItemSnapshots(scenario)[requestUrl.searchParams.get('url') ?? ''];
    switch (requestUrl.pathname) {
      case '/api/projects':
        return jsonResponse({ pjcodes: [projectCode] });
      case '/api/itembody':
        return jsonResponse({ body: itemSnapshot?.body ?? '' });
      case '/api/issuetitle':
        return jsonResponse(itemSnapshot?.state ?? {});
      default:
        return jsonResponse({});
    }
  };

const airplaneModeBeforeEach =
  (snapshot: AirplaneSnapshot, activeTab: ConsoleTabName) => async () => {
    const storybookPath = `${window.location.pathname}${window.location.search}`;
    window.localStorage.clear();
    await storeAirplaneSnapshot(snapshot);
    writeAirplaneModeFlag(true);
    window.history.replaceState(
      {},
      '',
      `/projects/${projectCode}/${activeTab}${window.location.search}`,
    );
    return async () => {
      writeAirplaneModeFlag(false);
      await clearAirplaneSnapshot();
      window.localStorage.clear();
      window.history.replaceState({}, '', storybookPath);
    };
  };

const scenarioAirplaneModeBeforeEach = (scenario: PageScenario) =>
  airplaneModeBeforeEach(
    scenarioAirplaneSnapshot(scenario),
    scenario.activeTab,
  );

const stubbedFetchBeforeEach =
  (scenario: PageScenario, writeResponse: () => Response) => async () => {
    const storybookPath = `${window.location.pathname}${window.location.search}`;
    const originalFetch = window.fetch;
    window.localStorage.clear();
    window.fetch = scenarioFetch(scenario, writeResponse, originalFetch);
    window.history.replaceState(
      {},
      '',
      `/projects/${projectCode}/${scenario.activeTab}${window.location.search}`,
    );
    return () => {
      window.fetch = originalFetch;
      window.localStorage.clear();
      window.history.replaceState({}, '', storybookPath);
    };
  };

type CanvasQueries = ReturnType<typeof within>;

const activeTabLabelOf = (canvasElement: HTMLElement): string | null =>
  canvasElement.querySelector(
    'a.console-tab[aria-current="page"] .console-tab-label',
  )?.textContent ?? null;

const isDetailScreenShown = (canvasElement: HTMLElement): boolean =>
  canvasElement.querySelector('.console-detail-screen') !== null;

const taskRowButtonOf = (
  canvas: CanvasQueries,
  item: ConsoleListItem,
): Promise<HTMLElement> =>
  canvas.findByRole(
    'button',
    {
      name: (accessibleName: string) => accessibleName.includes(item.title),
    },
    { timeout: PAGE_LOAD_TIMEOUT_MS },
  );

const taskHeadingOf = (
  canvas: CanvasQueries,
  item: ConsoleListItem,
): Promise<HTMLElement> =>
  canvas.findByRole('heading', {
    level: 2,
    name: (accessibleName: string) => accessibleName.includes(item.title),
  });

const openTaskFromList = async (
  canvas: CanvasQueries,
  item: ConsoleListItem,
): Promise<void> => {
  await userEvent.click(await taskRowButtonOf(canvas, item));
  await taskHeadingOf(canvas, item);
};

const submitDependedIssueUrl = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.click(canvas.getByTitle('Rare actions'));
  await userEvent.type(
    canvas.getByPlaceholderText('Depended issue URL'),
    dependedIssueUrl,
  );
  await userEvent.click(
    canvas.getByRole('button', { name: 'Set Depended Issue' }),
  );
};

const pressUndo = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.click(await canvas.findByRole('button', { name: 'Undo' }));
};

const sendSubmittedWritesNow = async (canvas: CanvasQueries): Promise<void> => {
  await userEvent.click(await canvas.findByRole('button', { name: '✕' }));
};

const twoAwaitingOwnerTasks = awaitingOwnerScenario({
  prs: [firstAwaitingOwnerItem, secondAwaitingOwnerItem],
});

const awaitingOwnerAndQueuedTasks = awaitingOwnerScenario({
  prs: [firstAwaitingOwnerItem],
  queued: [queuedItem],
});

const awaitingOwnerTaskAlone = awaitingOwnerScenario({
  prs: [firstAwaitingOwnerItem],
});

const withoutAwaitingWorkspaceOption: PageScenario = {
  ...awaitingOwnerTaskAlone,
  statusOptions: consoleStatusOptionsFixture.filter(
    (option) => option.name !== 'Awaiting Workspace',
  ),
};

const storiesTabScenario: PageScenario = {
  activeTab: 'stories',
  tabItems: {},
  statusOptions: consoleStatusOptionsFixture,
  storyEntries: [storyEntry],
};

const meta: Meta<typeof ConsolePage> = {
  title: 'Console/ConsolePage',
  component: ConsolePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof ConsolePage>;

export const AirplaneModeOn: Story = {
  beforeEach: airplaneModeBeforeEach(airplaneSnapshot, 'prs'),
};

export const DependedIssueSubmittedNextTaskShown: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(twoAwaitingOwnerTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await expect(
      await taskHeadingOf(canvas, secondAwaitingOwnerItem),
    ).toBeInTheDocument();
    await expect(
      await canvas.findByRole('button', { name: 'Undo' }),
    ).toBeInTheDocument();
  },
};

export const DependedIssueUndoneReturnsToSubmittedTask: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(twoAwaitingOwnerTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await taskHeadingOf(canvas, secondAwaitingOwnerItem);

    await pressUndo(canvas);

    await expect(
      await taskHeadingOf(canvas, firstAwaitingOwnerItem),
    ).toBeInTheDocument();
    await expect(activeTabLabelOf(canvasElement)).toBe('Awaiting Owner');
  },
};

export const DependedIssueSubmittedLastTaskClosesPanel: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(twoAwaitingOwnerTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, secondAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() => expect(isDetailScreenShown(canvasElement)).toBe(false));
    await expect(
      await taskRowButtonOf(canvas, firstAwaitingOwnerItem),
    ).toBeInTheDocument();
  },
};

export const DependedIssueSubmittedWritesHeld: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(twoAwaitingOwnerTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await taskHeadingOf(canvas, secondAwaitingOwnerItem);

    const offlinePanel = await canvas.findByRole(
      'region',
      { name: 'Offline actions queue' },
      { timeout: HELD_WRITE_TIMEOUT_MS },
    );

    await expect(offlinePanel).toHaveTextContent('2 actions held');
    await expect(
      await taskHeadingOf(canvas, secondAwaitingOwnerItem),
    ).toBeInTheDocument();
  },
};

export const DependedIssueSubmittedMovesToQueuedTab: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(awaitingOwnerAndQueuedTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() => expect(activeTabLabelOf(canvasElement)).toBe('Queued'));
    await expect(isDetailScreenShown(canvasElement)).toBe(false);
  },
};

export const DependedIssueUndoneReturnsToAwaitingOwnerTab: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(awaitingOwnerAndQueuedTasks),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() => expect(activeTabLabelOf(canvasElement)).toBe('Queued'));

    await pressUndo(canvas);

    await expect(
      await taskHeadingOf(canvas, firstAwaitingOwnerItem),
    ).toBeInTheDocument();
    await expect(activeTabLabelOf(canvasElement)).toBe('Awaiting Owner');
  },
};

export const DependedIssueSubmittedAloneClosesPanel: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(awaitingOwnerTaskAlone),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() => expect(isDetailScreenShown(canvasElement)).toBe(false));
    await expect(activeTabLabelOf(canvasElement)).toBe('Awaiting Owner');
  },
};

export const DependedIssueWriteRejected: Story = {
  beforeEach: stubbedFetchBeforeEach(awaitingOwnerTaskAlone, () =>
    jsonResponse({ error: 'boom' }, 500),
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await sendSubmittedWritesNow(canvas);

    const errorToast = await canvas.findByRole('alert');

    await expect(errorToast).toHaveTextContent('boom');
    await expect(
      within(errorToast).getByRole('button', { name: 'Retry' }),
    ).toBeInTheDocument();
    await expect(
      within(errorToast).getByRole('button', { name: 'Dismiss' }),
    ).toBeInTheDocument();
  },
};

export const DependedIssueWriteRejectedRetriedAndDismissed: Story = {
  beforeEach: stubbedFetchBeforeEach(awaitingOwnerTaskAlone, () =>
    jsonResponse({ error: 'boom' }, 500),
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await sendSubmittedWritesNow(canvas);
    const errorToast = await canvas.findByRole('alert');

    await userEvent.click(
      within(errorToast).getByRole('button', { name: 'Retry' }),
    );
    await expect(await canvas.findByRole('alert')).toHaveTextContent('boom');

    await userEvent.click(
      within(await canvas.findByRole('alert')).getByRole('button', {
        name: 'Dismiss',
      }),
    );
    await waitFor(() => expect(canvas.queryByRole('alert')).toBeNull());
  },
};

export const DependedIssueSubmittedWithoutAwaitingWorkspaceOption: Story = {
  beforeEach: stubbedFetchBeforeEach(withoutAwaitingWorkspaceOption, () =>
    jsonResponse({}),
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await openTaskFromList(canvas, firstAwaitingOwnerItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() =>
      expect(canvas.queryByPlaceholderText('Depended issue URL')).toBeNull(),
    );
    await expect(canvas.queryByRole('button', { name: 'Undo' })).toBeNull();
    await expect(
      await taskHeadingOf(canvas, firstAwaitingOwnerItem),
    ).toBeInTheDocument();
  },
};

export const DependedIssueSubmittedFromStoriesTab: Story = {
  beforeEach: scenarioAirplaneModeBeforeEach(storiesTabScenario),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [storyToggle] = await canvas.findAllByRole(
      'button',
      { name: storyEntry.storyName },
      { timeout: PAGE_LOAD_TIMEOUT_MS },
    );
    await userEvent.click(storyToggle);
    await openTaskFromList(canvas, storyTaskItem);
    await submitDependedIssueUrl(canvas);
    await waitFor(() => expect(isDetailScreenShown(canvasElement)).toBe(false));
    await expect(activeTabLabelOf(canvasElement)).toBe('Stories');
    await expect(
      (await canvas.findAllByRole('button', { name: storyEntry.storyName }))[0],
    ).toBeInTheDocument();
  },
};
