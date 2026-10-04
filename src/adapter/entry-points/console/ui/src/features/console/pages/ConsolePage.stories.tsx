import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  type AirplaneSnapshot,
  type AirplaneTabSnapshot,
  clearAirplaneSnapshot,
  storeAirplaneSnapshot,
  writeAirplaneModeFlag,
} from '../lib/airplaneSnapshot';
import type { ConsoleListItem, ConsoleTabName } from '../logic/types';
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

const meta: Meta<typeof ConsolePage> = {
  title: 'Console/ConsolePage',
  component: ConsolePage,
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof ConsolePage>;

export const AirplaneModeOn: Story = {
  beforeEach: async () => {
    const storybookPath = `${window.location.pathname}${window.location.search}`;
    window.localStorage.clear();
    await storeAirplaneSnapshot(airplaneSnapshot);
    writeAirplaneModeFlag(true);
    window.history.replaceState(
      {},
      '',
      `/projects/acme/prs${window.location.search}`,
    );
    return async () => {
      writeAirplaneModeFlag(false);
      await clearAirplaneSnapshot();
      window.history.replaceState({}, '', storybookPath);
    };
  },
};
