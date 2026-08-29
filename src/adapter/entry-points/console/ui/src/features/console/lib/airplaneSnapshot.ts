import type {
  ConsoleChangedFile,
  ConsoleComment,
  ConsoleCommit,
  ConsoleFieldOption,
  ConsoleIssueState,
  ConsoleListItem,
  ConsolePullRequestStatus,
  ConsoleRelatedPullRequest,
  ConsoleStoryColorSource,
  ConsoleStoryEntry,
  ConsoleTabName,
} from '../logic/types';

export type AirplaneTabSnapshot = {
  items: ConsoleListItem[];
  generatedAt: string;
  statusOptions: ConsoleFieldOption[];
  storyOptions: ConsoleFieldOption[];
  storyColors: ConsoleStoryColorSource;
  stories: ConsoleStoryEntry[];
  defaultNameWithOwner: string | null;
  fromCache: boolean;
  storyOrder: string[];
};

export type AirplaneItemSnapshot = {
  body: string;
  comments: ConsoleComment[];
  state: ConsoleIssueState;
  files: ConsoleChangedFile[] | null;
  commits: ConsoleCommit[] | null;
  prStatus: ConsolePullRequestStatus | null;
  relatedPrs: ConsoleRelatedPullRequest[] | null;
};

export type AirplaneSnapshot = {
  capturedAt: string;
  tabs: Record<string, Record<ConsoleTabName, AirplaneTabSnapshot>>;
  items: Record<string, AirplaneItemSnapshot>;
  failures: string[];
};

const AIRPLANE_CACHE_NAME = 'tdpm-airplane-v1';
const AIRPLANE_SNAPSHOT_REQUEST_URL = '/airplane-snapshot-data';
const AIRPLANE_MODE_STORAGE_KEY = 'tdpm_airplane_mode_on';

export const readAirplaneModeFlag = (): boolean => {
  if (typeof localStorage === 'undefined') {
    return false;
  }
  return localStorage.getItem(AIRPLANE_MODE_STORAGE_KEY) === '1';
};

export const writeAirplaneModeFlag = (on: boolean): void => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  if (on) {
    localStorage.setItem(AIRPLANE_MODE_STORAGE_KEY, '1');
  } else {
    localStorage.removeItem(AIRPLANE_MODE_STORAGE_KEY);
  }
};

export const storeAirplaneSnapshot = async (
  snapshot: AirplaneSnapshot,
): Promise<void> => {
  if (typeof caches === 'undefined') {
    throw new Error('Cache API unavailable');
  }
  try {
    const cache = await caches.open(AIRPLANE_CACHE_NAME);
    await cache.put(
      AIRPLANE_SNAPSHOT_REQUEST_URL,
      new Response(JSON.stringify(snapshot), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      throw new Error(
        'Not enough browser storage to save the offline snapshot. Free up storage and retry.',
      );
    }
    throw err;
  }
};

export const loadAirplaneSnapshot =
  async (): Promise<AirplaneSnapshot | null> => {
    if (typeof caches === 'undefined') {
      return null;
    }
    const cache = await caches.open(AIRPLANE_CACHE_NAME);
    const response = await cache.match(AIRPLANE_SNAPSHOT_REQUEST_URL);
    if (response === undefined) {
      return null;
    }
    return response.json() as Promise<AirplaneSnapshot>;
  };

export const clearAirplaneSnapshot = async (): Promise<void> => {
  if (typeof caches === 'undefined') {
    return;
  }
  await caches.delete(AIRPLANE_CACHE_NAME);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const getString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const getNumber = (value: unknown): number =>
  typeof value === 'number' ? value : 0;

const getBoolean = (value: unknown): boolean => value === true;

const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const parseMergeableStatus = (
  value: unknown,
): 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN' => {
  if (value === 'MERGEABLE') {
    return 'MERGEABLE';
  }
  if (value === 'CONFLICTING') {
    return 'CONFLICTING';
  }
  return 'UNKNOWN';
};

const parseListItem = (item: unknown): ConsoleListItem | null => {
  if (!isRecord(item)) {
    return null;
  }
  return {
    number: getNumber(item.number),
    title: getString(item.title),
    url: getString(item.url),
    repo: getString(item.repo),
    nameWithOwner: getString(item.nameWithOwner),
    projectItemId: getString(item.projectItemId),
    itemId: getString(item.itemId),
    isPr: getBoolean(item.isPr),
    story: getString(item.story),
    status: typeof item.status === 'string' ? item.status : null,
    nextActionDate:
      typeof item.nextActionDate === 'string' ? item.nextActionDate : null,
    nextActionHour:
      typeof item.nextActionHour === 'number' ? item.nextActionHour : null,
    dependedIssueUrls: parseStringArray(item.dependedIssueUrls),
    labels: parseStringArray(item.labels),
    createdAt: getString(item.createdAt),
    relatedOpenPullRequestUrls: parseStringArray(
      item.relatedOpenPullRequestUrls,
    ),
    agent: typeof item.agent === 'string' ? item.agent : null,
  };
};

const parseTabSnapshot = (payload: unknown): AirplaneTabSnapshot => {
  if (!isRecord(payload)) {
    return {
      items: [],
      generatedAt: '',
      statusOptions: [],
      storyOptions: [],
      storyColors: {},
      stories: [],
      defaultNameWithOwner: null,
      fromCache: false,
      storyOrder: [],
    };
  }
  const items: ConsoleListItem[] = Array.isArray(payload.items)
    ? payload.items
        .map(parseListItem)
        .filter((item): item is ConsoleListItem => item !== null)
    : [];
  const statusOptions: ConsoleFieldOption[] = Array.isArray(
    payload.statusOptions,
  )
    ? (payload.statusOptions.filter(isRecord) as ConsoleFieldOption[])
    : [];
  const storyOptions: ConsoleFieldOption[] = Array.isArray(payload.storyOptions)
    ? (payload.storyOptions.filter(isRecord) as ConsoleFieldOption[])
    : [];
  const stories: ConsoleStoryEntry[] = Array.isArray(payload.stories)
    ? (payload.stories.filter(isRecord) as unknown as ConsoleStoryEntry[])
    : [];
  const storyOrder: string[] = Array.isArray(payload.storyOrder)
    ? payload.storyOrder.filter((s): s is string => typeof s === 'string')
    : [];
  return {
    items,
    generatedAt:
      typeof payload.generatedAt === 'string' ? payload.generatedAt : '',
    statusOptions,
    storyOptions,
    storyColors: isRecord(payload.storyColors)
      ? (payload.storyColors as ConsoleStoryColorSource)
      : {},
    stories,
    defaultNameWithOwner:
      typeof payload.defaultNameWithOwner === 'string'
        ? payload.defaultNameWithOwner
        : null,
    fromCache: false,
    storyOrder,
  };
};

const parseComment = (item: unknown): ConsoleComment | null => {
  if (!isRecord(item)) {
    return null;
  }
  return {
    author: getString(item.author),
    body: getString(item.body),
    createdAt: getString(item.createdAt),
  };
};

const parseChangedFile = (item: unknown): ConsoleChangedFile | null => {
  if (!isRecord(item)) {
    return null;
  }
  return {
    path: getString(item.path),
    additions: getNumber(item.additions),
    deletions: getNumber(item.deletions),
    status: getString(item.status),
    patch: typeof item.patch === 'string' ? item.patch : null,
    rawUrl: typeof item.rawUrl === 'string' ? item.rawUrl : null,
  };
};

const parseCommit = (item: unknown): ConsoleCommit | null => {
  if (!isRecord(item)) {
    return null;
  }
  return {
    sha: getString(item.sha),
    message: getString(item.message),
    author: getString(item.author),
    authoredAt: getString(item.authoredAt),
  };
};

const parsePrStatus = (item: unknown): ConsolePullRequestStatus => {
  if (!isRecord(item)) {
    return {
      found: false,
      isConflicted: false,
      mergeableStatus: 'UNKNOWN',
      isPassedAllCiJob: false,
      isCiStateSuccess: false,
      isBranchOutOfDate: false,
      missingRequiredCheckNames: [],
    };
  }
  return {
    found: getBoolean(item.found),
    isConflicted: getBoolean(item.isConflicted),
    mergeableStatus: parseMergeableStatus(item.mergeableStatus),
    isPassedAllCiJob: getBoolean(item.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(item.isCiStateSuccess),
    isBranchOutOfDate: getBoolean(item.isBranchOutOfDate),
    missingRequiredCheckNames: parseStringArray(item.missingRequiredCheckNames),
  };
};

const parseRelatedPr = (item: unknown): ConsoleRelatedPullRequest | null => {
  if (!isRecord(item)) {
    return null;
  }
  const summary = isRecord(item.summary)
    ? {
        title: getString(item.summary.title),
        body: getString(item.summary.body),
        additions: getNumber(item.summary.additions),
        deletions: getNumber(item.summary.deletions),
        changedFiles: getNumber(item.summary.changedFiles),
      }
    : null;
  return {
    url: getString(item.url),
    branchName: typeof item.branchName === 'string' ? item.branchName : null,
    createdAt: getString(item.createdAt),
    isDraft: getBoolean(item.isDraft),
    isConflicted: getBoolean(item.isConflicted),
    mergeableStatus: parseMergeableStatus(item.mergeableStatus),
    isPassedAllCiJob: getBoolean(item.isPassedAllCiJob),
    isCiStateSuccess: getBoolean(item.isCiStateSuccess),
    isResolvedAllReviewComments: getBoolean(item.isResolvedAllReviewComments),
    isBranchOutOfDate: getBoolean(item.isBranchOutOfDate),
    missingRequiredCheckNames: parseStringArray(item.missingRequiredCheckNames),
    summary,
  };
};

const parseItemSnapshot = (item: unknown): AirplaneItemSnapshot => {
  if (!isRecord(item)) {
    return {
      body: '',
      comments: [],
      state: { state: 'open', merged: false, isPullRequest: false, title: '' },
      files: null,
      commits: null,
      prStatus: null,
      relatedPrs: null,
    };
  }
  const stateRaw = isRecord(item.state) ? item.state : {};
  const state: ConsoleIssueState = {
    state: getString(stateRaw.state) || 'open',
    merged: getBoolean(stateRaw.merged),
    isPullRequest: getBoolean(stateRaw.isPullRequest),
    title: getString(stateRaw.title),
  };
  const files =
    item.files === null
      ? null
      : Array.isArray(item.files)
        ? item.files
            .map(parseChangedFile)
            .filter((f): f is ConsoleChangedFile => f !== null)
        : null;
  const commits =
    item.commits === null
      ? null
      : Array.isArray(item.commits)
        ? item.commits
            .map(parseCommit)
            .filter((c): c is ConsoleCommit => c !== null)
        : null;
  const prStatus = item.prStatus === null ? null : parsePrStatus(item.prStatus);
  const relatedPrs =
    item.relatedPrs === null
      ? null
      : Array.isArray(item.relatedPrs)
        ? item.relatedPrs
            .map(parseRelatedPr)
            .filter((pr): pr is ConsoleRelatedPullRequest => pr !== null)
        : null;
  return {
    body: getString(item.body),
    comments: Array.isArray(item.comments)
      ? item.comments
          .map(parseComment)
          .filter((c): c is ConsoleComment => c !== null)
      : [],
    state,
    files,
    commits,
    prStatus,
    relatedPrs,
  };
};

export const parseAirplaneSnapshot = (
  raw: unknown,
): AirplaneSnapshot | null => {
  if (!isRecord(raw)) {
    return null;
  }
  const capturedAt = typeof raw.capturedAt === 'string' ? raw.capturedAt : '';
  const failures = parseStringArray(raw.failures);

  const tabs: Record<string, Record<ConsoleTabName, AirplaneTabSnapshot>> = {};
  if (isRecord(raw.tabs)) {
    for (const [pjcode, pjTabs] of Object.entries(raw.tabs)) {
      if (!isRecord(pjTabs)) {
        continue;
      }
      const parsedPjTabs: Record<string, AirplaneTabSnapshot> = {};
      for (const [tabName, tabPayload] of Object.entries(pjTabs)) {
        parsedPjTabs[tabName] = parseTabSnapshot(tabPayload);
      }
      tabs[pjcode] = parsedPjTabs as Record<
        ConsoleTabName,
        AirplaneTabSnapshot
      >;
    }
  }

  const items: Record<string, AirplaneItemSnapshot> = {};
  if (isRecord(raw.items)) {
    for (const [url, itemData] of Object.entries(raw.items)) {
      items[url] = parseItemSnapshot(itemData);
    }
  }

  return { capturedAt, tabs, items, failures };
};
