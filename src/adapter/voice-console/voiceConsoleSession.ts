import type {
  IssueComment,
  IssueRepository,
  OpenPullRequestCiStatus,
  PullRequestCommit,
  PullRequestDetail,
} from '../../domain/usecases/adapter-interfaces/IssueRepository';
import { paginateText } from './voiceConsolePaging';
import {
  VoiceConsolePendingActionStore,
  type PreparedVoiceAction,
} from './voiceConsolePendingAction';
import {
  buildVoiceConsoleQueue,
  type VoiceConsoleQueueEntry,
} from './voiceConsoleQueue';
import {
  extractLatestReportSummary,
  type VoiceConsoleTaskComment,
} from './voiceConsoleTaskDocument';

export type VoiceConsoleOperationResponse = {
  statusCode: number;
  body: unknown;
};

export type VoiceConsoleSessionDeps = {
  consoleDataOutputDir: string | null;
  projectPjcodes: string[];
  resolveIssueRepository: (issueOrPullRequestUrl: string) => IssueRepository;
  searchIssues: (query: string) => Promise<unknown[]>;
  getAuthenticatedUserLogin: () => Promise<string>;
  readRepositoryFile: (
    owner: string,
    repo: string,
    ref: string,
    filePath: string,
  ) => Promise<string>;
  runOperation: (
    requestPath: string,
    body: Record<string, unknown>,
  ) => Promise<VoiceConsoleOperationResponse>;
  newActionId: () => string;
  logError: (message: string) => void;
};

type ToolResult = Record<string, unknown>;

type ToolArguments = Record<string, unknown>;

// A rejection is a validation outcome returned to the model; it is not logged.
class VoiceConsoleRejection extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type StagedActionDraft = {
  requestPath: string;
  body: Record<string, unknown>;
  readBack: string;
  removesFromQueue: boolean;
};

type GithubIssueOrPullReference = {
  owner: string;
  repo: string;
  kind: 'issues' | 'pull';
};

type GithubBlobReference = {
  owner: string;
  repo: string;
  ref: string;
  filePath: string;
};

const SNOOZE_ACTIONS: Record<string, string> = {
  '1h': 'snooze_1hour',
  '3h': 'snooze_3hours',
  '6h': 'snooze_6hours',
  '1d': 'snooze_1day',
  '2d': 'snooze_2days',
  '3d': 'snooze_3days',
  '5d': 'snooze_5days',
  '1w': 'snooze_1week',
  '1month': 'snooze_1month',
};

const PULL_REQUEST_REVIEW_ACTIONS = [
  'approve_and_merge',
  'request_changes',
  'unnecessary',
  'totally_wrong',
];

const CLOSE_REASONS = ['completed', 'not_planned'];
const CLOSE_COMMENT_KINDS = ['none', 'ok', 'text'];
const OK_STATUS_NAME = 'Awaiting Workspace';
const OK_COMMENT_TEXT = 'ok';
const UNNECESSARY_COMMENT_TEXT = 'This pull request is unnecessary.';
const TOTALLY_WRONG_COMMENT_TEXT = 'totally wrong';
const QUALIFIER_PATTERN = /(^|\s)(user|org|repo):/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failure = (error: string): ToolResult => ({ ok: false, error });

const parseToolArguments = (argumentsJson: string): ToolArguments => {
  if (argumentsJson.trim() === '') {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  if (!isRecord(parsed)) {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return parsed;
};

const readString = (args: ToolArguments, key: string): string => {
  const value = args[key];
  if (typeof value !== 'string') {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const readNonEmptyString = (
  args: ToolArguments,
  key: string,
  missingError: string,
): string => {
  const value = args[key];
  if (value === undefined || value === '') {
    throw new VoiceConsoleRejection(missingError);
  }
  if (typeof value !== 'string') {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const readOptionalString = (
  args: ToolArguments,
  key: string,
): string | undefined => {
  const value = args[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const readOptionalPage = (args: ToolArguments): number | undefined => {
  const value = args.page;
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number') {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const readRequiredPosition = (args: ToolArguments): number => {
  const value = args.position;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const readEnum = (
  args: ToolArguments,
  key: string,
  allowed: string[],
): string => {
  const value = readString(args, key);
  if (!allowed.includes(value)) {
    throw new VoiceConsoleRejection('invalid_arguments');
  }
  return value;
};

const safeDecode = (segment: string): string | null => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

const parseGithubUrl = (url: string): URL | null => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'github.com' ? parsed : null;
  } catch {
    return null;
  }
};

const pathSegments = (parsed: URL): string[] =>
  parsed.pathname.split('/').filter((segment) => segment !== '');

const parseGithubIssueOrPullUrl = (
  url: string,
): GithubIssueOrPullReference | null => {
  const parsed = parseGithubUrl(url);
  if (parsed === null) {
    return null;
  }
  const segments = pathSegments(parsed);
  if (segments.length !== 4 || !/^\d+$/.test(segments[3])) {
    return null;
  }
  if (segments[2] !== 'issues' && segments[2] !== 'pull') {
    return null;
  }
  return { owner: segments[0], repo: segments[1], kind: segments[2] };
};

const isSafeRepositoryFilePath = (filePath: string): boolean =>
  filePath
    .split('/')
    .every(
      (segment) =>
        segment !== '' &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\'),
    );

const parseGithubBlobUrl = (url: string): GithubBlobReference | null => {
  const parsed = parseGithubUrl(url);
  if (parsed === null) {
    return null;
  }
  const segments = pathSegments(parsed);
  if (segments.length < 5 || segments[2] !== 'blob') {
    return null;
  }
  const decodedPath = segments.slice(4).map(safeDecode);
  if (decodedPath.some((segment) => segment === null)) {
    return null;
  }
  const filePath = decodedPath.join('/');
  if (!isSafeRepositoryFilePath(filePath)) {
    return null;
  }
  return {
    owner: segments[0],
    repo: segments[1],
    ref: segments[3],
    filePath,
  };
};

const queueEntryKey = (entry: VoiceConsoleQueueEntry): string =>
  `${entry.pjcode}/${entry.tab}/${entry.item.projectItemId}`;

const toTaskComment = (comment: IssueComment): VoiceConsoleTaskComment => ({
  author: comment.author,
  body: comment.body,
  createdAt: comment.createdAt.toISOString(),
});

const renderCommentsSection = (comments: IssueComment[]): string[] =>
  comments.flatMap((comment) => [
    `### ${comment.author} ${comment.createdAt.toISOString()}`,
    comment.body,
    '',
  ]);

const renderIssueDocument = (
  headerLines: string[],
  body: string,
  comments: IssueComment[],
): string =>
  [
    ...headerLines,
    '',
    '## Body',
    body,
    '',
    '## Comments',
    ...renderCommentsSection(comments),
  ].join('\n');

const renderPullRequestDocument = (
  detail: PullRequestDetail,
  commits: PullRequestCommit[],
  ciStatus: OpenPullRequestCiStatus | null,
): string => {
  const fileLines = detail.files.map(
    (file) =>
      `- ${file.filename} (${file.status}, +${file.additions} -${file.deletions})`,
  );
  const commitLines = commits.map(
    (commit) =>
      `- ${commit.sha.slice(0, 7)} ${commit.authoredAt.toISOString()} ${commit.author}: ${commit.message.split('\n')[0]}`,
  );
  const ciLines =
    ciStatus === null
      ? ['CI status: unavailable']
      : [
          `CI status: all jobs passed ${ciStatus.isPassedAllCiJob}, CI state success ${ciStatus.isCiStateSuccess}`,
          `Mergeable: ${ciStatus.mergeable ?? 'unknown'}, conflicted ${ciStatus.isConflicted}, branch out of date ${ciStatus.isBranchOutOfDate}`,
        ];
  return [
    `# ${detail.title}`,
    `State: ${detail.state}, merged ${detail.merged}, draft ${detail.isDraft}`,
    `Author: ${detail.author}`,
    `Branch: ${detail.headRefName} into ${detail.baseRefName}`,
    `Changed files: ${detail.changedFiles}, +${detail.additions} -${detail.deletions}`,
    ...ciLines,
    '',
    '## Changed files',
    ...fileLines,
    '',
    '## Commits',
    ...commitLines,
  ].join('\n');
};

const paginatedResult = (
  base: ToolResult,
  text: string,
  page: number | undefined,
): ToolResult => {
  const paged = paginateText(text, page);
  if (!paged.ok) {
    return { ok: false, error: paged.error, pageCount: paged.pageCount };
  }
  return {
    ok: true,
    ...base,
    page: paged.page,
    pageCount: paged.pageCount,
    text: paged.text,
  };
};

export class VoiceConsoleSession {
  private entries: VoiceConsoleQueueEntry[] = [];
  private loaded = false;
  private index = 0;
  private readonly removedKeys = new Set<string>();
  private readonly pendingActions = new VoiceConsolePendingActionStore();
  private pendingTargetKey: string | null = null;

  constructor(private readonly deps: VoiceConsoleSessionDeps) {}

  async callTool(name: string, argumentsJson: string): Promise<string> {
    let args: ToolArguments;
    try {
      args = parseToolArguments(argumentsJson);
    } catch (error) {
      if (error instanceof VoiceConsoleRejection) {
        return JSON.stringify(failure(error.code));
      }
      throw error;
    }
    try {
      return JSON.stringify(await this.dispatch(name, args));
    } catch (error) {
      if (error instanceof VoiceConsoleRejection) {
        return JSON.stringify(failure(error.code));
      }
      this.deps.logError(
        `voice console tool ${name} failed: ${describeError(error)}`,
      );
      return JSON.stringify(failure('tool_failed'));
    }
  }

  private async dispatch(
    name: string,
    args: ToolArguments,
  ): Promise<ToolResult> {
    switch (name) {
      case 'queue_overview':
        return this.queueOverview();
      case 'current_task_summary':
        return this.currentTaskSummary(args);
      case 'current_task_detail':
        return this.currentTaskDetail(args);
      case 'read_github_url':
        return this.readGithubUrl(args);
      case 'read_pull_request':
        return this.readPullRequest(args);
      case 'read_repository_file':
        return this.readRepositoryFileTool(args);
      case 'search_issues':
        return this.searchIssuesTool(args);
      case 'next_task':
        return this.moveToNextTask();
      case 'previous_task':
        return this.moveToPreviousTask();
      case 'jump_to_task':
        return this.jumpToTask(args);
      case 'prepare_ok':
        return this.prepareOk();
      case 'prepare_comment_and_move_to_awaiting_workspace':
        return this.prepareCommentAndMoveToAwaitingWorkspace(args);
      case 'prepare_comment_only':
        return this.prepareCommentOnly(args);
      case 'prepare_close':
        return this.prepareClose(args);
      case 'prepare_snooze':
        return this.prepareSnooze(args);
      case 'prepare_set_status':
        return this.prepareSetStatus(args);
      case 'prepare_move_to_in_tmux_by_human':
        return this.prepareMoveToInTmuxByHuman();
      case 'prepare_pull_request_review':
        return this.preparePullRequestReview(args);
      case 'confirm_pending_action':
        return this.confirmPendingAction(args);
      case 'cancel_pending_action':
        return this.cancelPendingAction();
      default:
        return failure('unknown_tool');
    }
  }

  // Queue snapshot

  private ensureQueueLoaded(): void {
    if (!this.loaded) {
      this.reloadQueue();
    }
  }

  private reloadQueue(): void {
    const dataDir = this.deps.consoleDataOutputDir;
    const built =
      dataDir === null
        ? []
        : buildVoiceConsoleQueue({
            consoleDataOutputDir: dataDir,
            projectPjcodes: this.deps.projectPjcodes,
          });
    this.applyEntries(
      built.filter((entry) => !this.removedKeys.has(queueEntryKey(entry))),
    );
  }

  // Keeps the current item when it is still present, otherwise clamps the position.
  private applyEntries(visible: VoiceConsoleQueueEntry[]): void {
    const currentKey =
      this.index < this.entries.length
        ? queueEntryKey(this.entries[this.index])
        : null;
    const keptIndex =
      currentKey === null
        ? -1
        : visible.findIndex((entry) => queueEntryKey(entry) === currentKey);
    this.entries = visible;
    this.index =
      keptIndex !== -1
        ? keptIndex
        : Math.max(0, Math.min(this.index, visible.length - 1));
    this.loaded = true;
  }

  private removeQueueEntry(key: string): void {
    this.removedKeys.add(key);
    this.applyEntries(
      this.entries.filter((entry) => queueEntryKey(entry) !== key),
    );
  }

  private currentEntry(): VoiceConsoleQueueEntry | null {
    this.ensureQueueLoaded();
    return this.index < this.entries.length ? this.entries[this.index] : null;
  }

  private requireCurrentEntry(): VoiceConsoleQueueEntry {
    const entry = this.currentEntry();
    if (entry === null) {
      throw new VoiceConsoleRejection('no_current_task');
    }
    return entry;
  }

  private describeEntry(entry: VoiceConsoleQueueEntry): ToolResult {
    return {
      position: this.index + 1,
      totalCount: this.entries.length,
      pjcode: entry.pjcode,
      tab: entry.tab,
      number: entry.item.number,
      title: entry.item.title,
      url: entry.item.url,
      isPr: entry.item.isPr,
      status: entry.item.status,
      story: entry.item.story,
      labels: entry.item.labels,
      dependedIssueUrls: entry.item.dependedIssueUrls,
      relatedOpenPullRequestUrls: entry.item.relatedOpenPullRequestUrls,
    };
  }

  private queueOverview(): ToolResult {
    this.reloadQueue();
    const entry = this.currentEntry();
    const countTab = (
      entries: VoiceConsoleQueueEntry[],
      tab: VoiceConsoleQueueEntry['tab'],
    ): number => entries.filter((entry) => entry.tab === tab).length;
    const projects = this.deps.projectPjcodes.map((pjcode) => {
      const projectEntries = this.entries.filter(
        (entry) => entry.pjcode === pjcode,
      );
      return {
        pjcode,
        todoByHumanCount: countTab(projectEntries, 'todo-by-human'),
        prsCount: countTab(projectEntries, 'prs'),
      };
    });
    return {
      ok: true,
      totalCount: this.entries.length,
      todoByHumanCount: countTab(this.entries, 'todo-by-human'),
      prsCount: countTab(this.entries, 'prs'),
      projects,
      current: entry === null ? null : this.describeEntry(entry),
    };
  }

  private moveToNextTask(): ToolResult {
    this.ensureQueueLoaded();
    if (this.entries.length === 0) {
      return failure('queue_empty');
    }
    if (this.index + 1 >= this.entries.length) {
      return failure('end_of_queue');
    }
    this.index += 1;
    return { ok: true, ...this.describeEntry(this.entries[this.index]) };
  }

  private moveToPreviousTask(): ToolResult {
    this.ensureQueueLoaded();
    if (this.entries.length === 0) {
      return failure('queue_empty');
    }
    if (this.index === 0) {
      return failure('start_of_queue');
    }
    this.index -= 1;
    return { ok: true, ...this.describeEntry(this.entries[this.index]) };
  }

  private jumpToTask(args: ToolArguments): ToolResult {
    const position = readRequiredPosition(args);
    this.ensureQueueLoaded();
    if (position < 1 || position > this.entries.length) {
      return failure('position_out_of_range');
    }
    this.index = position - 1;
    return { ok: true, ...this.describeEntry(this.entries[this.index]) };
  }

  // Reading tools

  private async currentTaskSummary(args: ToolArguments): Promise<ToolResult> {
    const entry = this.currentEntry();
    if (entry === null) {
      return failure('no_current_task');
    }
    const page = readOptionalPage(args);
    const repository = this.deps.resolveIssueRepository(entry.item.url);
    const comments = await repository.getIssueOrPullRequestComments(
      entry.item.url,
    );
    const summary = extractLatestReportSummary(comments.map(toTaskComment));
    return paginatedResult(
      { reportFound: summary !== null },
      summary ?? '',
      page,
    );
  }

  private async currentTaskDetail(args: ToolArguments): Promise<ToolResult> {
    const entry = this.currentEntry();
    if (entry === null) {
      return failure('no_current_task');
    }
    const page = readOptionalPage(args);
    const repository = this.deps.resolveIssueRepository(entry.item.url);
    const body = await repository.getIssueOrPullRequestBody(entry.item.url);
    const comments = await repository.getIssueOrPullRequestComments(
      entry.item.url,
    );
    const text = renderIssueDocument(
      [
        `# ${entry.item.title}`,
        `URL: ${entry.item.url}`,
        `Status: ${entry.item.status ?? 'none'}`,
        `Story: ${entry.item.story}`,
        `Labels: ${entry.item.labels.join(', ')}`,
        `Depends on: ${entry.item.dependedIssueUrls.join(', ')}`,
        `Created: ${entry.item.createdAt}`,
      ],
      body,
      comments,
    );
    return paginatedResult({}, text, page);
  }

  private async readGithubUrl(args: ToolArguments): Promise<ToolResult> {
    const url = readString(args, 'url');
    const reference = parseGithubIssueOrPullUrl(url);
    if (reference === null) {
      return failure('invalid_url');
    }
    const page = readOptionalPage(args);
    const repository = this.deps.resolveIssueRepository(url);
    const body = await repository.getIssueOrPullRequestBody(url);
    const comments = await repository.getIssueOrPullRequestComments(url);
    const text = renderIssueDocument([`URL: ${url}`], body, comments);
    return paginatedResult({}, text, page);
  }

  private async readPullRequest(args: ToolArguments): Promise<ToolResult> {
    const explicitUrl = readOptionalString(args, 'url');
    const url = explicitUrl ?? this.currentPullRequestUrl();
    if (url === null) {
      return failure('pull_request_url_required');
    }
    const reference = parseGithubIssueOrPullUrl(url);
    if (reference === null || reference.kind !== 'pull') {
      return failure('invalid_url');
    }
    const page = readOptionalPage(args);
    const repository = this.deps.resolveIssueRepository(url);
    const detail = await repository.getPullRequestDetail(url);
    if (detail === null) {
      return failure('pull_request_not_found');
    }
    const commits = await repository.getPullRequestCommits(url);
    const ciStatus = await repository.getOpenPullRequestCiStatus(url);
    return paginatedResult(
      {},
      renderPullRequestDocument(detail, commits, ciStatus),
      page,
    );
  }

  private currentPullRequestUrl(): string | null {
    const entry = this.currentEntry();
    if (entry === null) {
      return null;
    }
    return entry.item.isPr
      ? entry.item.url
      : (entry.item.relatedOpenPullRequestUrls[0] ?? null);
  }

  private async readRepositoryFileTool(
    args: ToolArguments,
  ): Promise<ToolResult> {
    const url = readString(args, 'url');
    const reference = parseGithubBlobUrl(url);
    if (reference === null) {
      return failure('invalid_url');
    }
    const page = readOptionalPage(args);
    const text = await this.deps.readRepositoryFile(
      reference.owner,
      reference.repo,
      reference.ref,
      reference.filePath,
    );
    return paginatedResult({}, text, page);
  }

  private async searchIssuesTool(args: ToolArguments): Promise<ToolResult> {
    const query = readString(args, 'query');
    const page = readOptionalPage(args);
    const scopedQuery = QUALIFIER_PATTERN.test(query)
      ? query
      : `user:${await this.deps.getAuthenticatedUserLogin()} ${query}`;
    const results = await this.deps.searchIssues(scopedQuery);
    return paginatedResult({}, JSON.stringify(results), page);
  }

  // Write tools: prepare, then confirm_pending_action

  private stageAction(
    entry: VoiceConsoleQueueEntry,
    draft: StagedActionDraft,
  ): ToolResult {
    const actionId = this.deps.newActionId();
    const action: PreparedVoiceAction = {
      actionId,
      requestPath: draft.requestPath,
      body: { ...draft.body, actionId },
      readBack: draft.readBack,
      removesFromQueue: draft.removesFromQueue,
    };
    this.pendingActions.prepare(action);
    this.pendingTargetKey = queueEntryKey(entry);
    return {
      ok: true,
      actionId,
      readBack: draft.readBack,
      target: {
        pjcode: entry.pjcode,
        url: entry.item.url,
        title: entry.item.title,
      },
    };
  }

  private triageBody(entry: VoiceConsoleQueueEntry): Record<string, unknown> {
    return {
      pjcode: entry.pjcode,
      issueUrl: entry.item.url,
      projectItemId: entry.item.projectItemId,
      expectedStatusName: entry.item.status,
    };
  }

  private requireStatusOption(
    entry: VoiceConsoleQueueEntry,
    statusName: string,
  ): string {
    const found = entry.statusOptions.some(
      (option) => option.name === statusName,
    );
    if (!found) {
      throw new VoiceConsoleRejection('unknown_status');
    }
    return statusName;
  }

  private prepareOk(): ToolResult {
    const entry = this.requireCurrentEntry();
    const statusName = this.requireStatusOption(entry, OK_STATUS_NAME);
    return this.stageAction(entry, {
      requestPath: '/api/triage',
      body: {
        ...this.triageBody(entry),
        action: 'set_status',
        statusName,
        commentBody: OK_COMMENT_TEXT,
        setStatusWhenCommentFails: true,
      },
      readBack: `「${entry.item.title}」に ok のコメントを付け、${statusName} に移します。`,
      removesFromQueue: true,
    });
  }

  private prepareCommentAndMoveToAwaitingWorkspace(
    args: ToolArguments,
  ): ToolResult {
    const commentText = readNonEmptyString(
      args,
      'comment_text',
      'comment_text_required',
    );
    const entry = this.requireCurrentEntry();
    const statusName = this.requireStatusOption(entry, OK_STATUS_NAME);
    return this.stageAction(entry, {
      requestPath: '/api/triage',
      body: {
        ...this.triageBody(entry),
        action: 'set_status',
        statusName,
        commentBody: commentText,
      },
      readBack: `「${entry.item.title}」にコメント「${commentText}」を付け、${statusName} に移します。`,
      removesFromQueue: true,
    });
  }

  private prepareCommentOnly(args: ToolArguments): ToolResult {
    const commentText = readNonEmptyString(
      args,
      'comment_text',
      'comment_text_required',
    );
    const entry = this.requireCurrentEntry();
    return this.stageAction(entry, {
      requestPath: '/api/comment',
      body: {
        pjcode: entry.pjcode,
        url: entry.item.url,
        body: commentText,
      },
      readBack: `「${entry.item.title}」にコメント「${commentText}」を付けます。ステータスは変えません。`,
      removesFromQueue: false,
    });
  }

  private prepareClose(args: ToolArguments): ToolResult {
    const reason = readEnum(args, 'reason', CLOSE_REASONS);
    const commentKind = readEnum(args, 'comment_kind', CLOSE_COMMENT_KINDS);
    const commentText =
      commentKind === 'text'
        ? readNonEmptyString(args, 'comment_text', 'comment_text_required')
        : null;
    const entry = this.requireCurrentEntry();
    const commentBody =
      commentKind === 'ok'
        ? OK_COMMENT_TEXT
        : commentKind === 'text'
          ? commentText
          : null;
    const closeAction = reason === 'completed' ? 'close' : 'close_not_planned';
    const commentPart =
      commentBody === null ? '' : `、コメント「${commentBody}」を付けて`;
    return this.stageAction(entry, {
      requestPath: '/api/triage',
      body: {
        pjcode: entry.pjcode,
        action: closeAction,
        issueUrl: entry.item.url,
        projectItemId: entry.item.projectItemId,
        ...(commentBody === null ? {} : { commentBody }),
      },
      readBack: `「${entry.item.title}」${commentPart}${reason} として閉じます。`,
      removesFromQueue: true,
    });
  }

  private prepareSnooze(args: ToolArguments): ToolResult {
    const preset = readString(args, 'preset');
    const action = SNOOZE_ACTIONS[preset];
    if (action === undefined) {
      throw new VoiceConsoleRejection('invalid_preset');
    }
    const entry = this.requireCurrentEntry();
    return this.stageAction(entry, {
      requestPath: '/api/triage',
      body: {
        pjcode: entry.pjcode,
        action,
        issueUrl: entry.item.url,
        projectItemId: entry.item.projectItemId,
      },
      readBack: `「${entry.item.title}」を ${preset} スヌーズします。`,
      removesFromQueue: true,
    });
  }

  private prepareSetStatus(args: ToolArguments): ToolResult {
    const requestedStatus = readString(args, 'status_name');
    const entry = this.requireCurrentEntry();
    const statusName = this.requireStatusOption(entry, requestedStatus);
    return this.stageAction(entry, {
      requestPath: '/api/triage',
      body: {
        ...this.triageBody(entry),
        action: 'set_status',
        statusName,
      },
      readBack: `「${entry.item.title}」を ${statusName} に移します。`,
      removesFromQueue: true,
    });
  }

  private prepareMoveToInTmuxByHuman(): ToolResult {
    const entry = this.requireCurrentEntry();
    return this.stageAction(entry, {
      requestPath: '/api/intmux',
      body: { ...this.triageBody(entry), action: 'set_intmux' },
      readBack: `「${entry.item.title}」を In tmux by human に移します。`,
      removesFromQueue: true,
    });
  }

  private preparePullRequestReview(args: ToolArguments): ToolResult {
    const action = readEnum(args, 'action', PULL_REQUEST_REVIEW_ACTIONS);
    const entry = this.requireCurrentEntry();
    const prUrl = this.currentPullRequestUrl();
    if (prUrl === null) {
      throw new VoiceConsoleRejection('pull_request_url_required');
    }
    const baseBody = {
      pjcode: entry.pjcode,
      prUrl,
      projectItemId: entry.item.projectItemId,
      expectedStatusName: entry.item.status,
    };
    if (action === 'approve_and_merge') {
      return this.stageAction(entry, {
        requestPath: '/api/review',
        body: { ...baseBody, action },
        readBack: `プルリクエスト ${prUrl} を承認してマージします。`,
        removesFromQueue: true,
      });
    }
    if (action === 'request_changes') {
      const commentText = readNonEmptyString(
        args,
        'comment_text',
        'comment_text_required',
      );
      return this.stageAction(entry, {
        requestPath: '/api/review',
        body: { ...baseBody, action, commentBody: commentText },
        readBack: `プルリクエスト ${prUrl} に変更依頼「${commentText}」を出します。`,
        removesFromQueue: false,
      });
    }
    if (action === 'unnecessary') {
      return this.stageAction(entry, {
        requestPath: '/api/review',
        body: {
          ...baseBody,
          action,
          issueUrl: entry.item.url,
          commentBody: UNNECESSARY_COMMENT_TEXT,
          issueCommentBody: `The pull request for this issue was unnecessary and has been closed: ${prUrl}\n\nDo not create it again.`,
        },
        readBack: `プルリクエスト ${prUrl} は不要だったとして閉じます。`,
        removesFromQueue: true,
      });
    }
    return this.stageAction(entry, {
      requestPath: '/api/review',
      body: {
        ...baseBody,
        action: 'close',
        issueUrl: entry.item.url,
        commentBody: TOTALLY_WRONG_COMMENT_TEXT,
      },
      readBack: `プルリクエスト ${prUrl} を内容が違うとして閉じます。`,
      removesFromQueue: true,
    });
  }

  private async confirmPendingAction(args: ToolArguments): Promise<ToolResult> {
    const actionId = readString(args, 'action_id');
    const ownerReply = readString(args, 'owner_reply');
    const confirmed = this.pendingActions.confirm(actionId, ownerReply);
    if (!confirmed.ok) {
      return failure(confirmed.error);
    }
    const targetKey = this.pendingTargetKey;
    this.pendingTargetKey = null;
    const action = confirmed.action;

    let response: VoiceConsoleOperationResponse;
    try {
      response = await this.deps.runOperation(action.requestPath, action.body);
    } catch (error) {
      this.deps.logError(
        `voice console operation ${action.requestPath} failed: ${describeError(error)}`,
      );
      return failure('tool_failed');
    }
    if (response.statusCode >= 400 || operationBodyFailed(response.body)) {
      return failure(operationErrorText(response.body));
    }
    if (action.removesFromQueue && targetKey !== null) {
      this.removeQueueEntry(targetKey);
    }
    return { ok: true, readBack: action.readBack };
  }

  private cancelPendingAction(): ToolResult {
    this.pendingActions.cancel();
    this.pendingTargetKey = null;
    return { ok: true };
  }
}

const operationBodyFailed = (body: unknown): boolean =>
  isRecord(body) && body.ok === false;

const operationErrorText = (body: unknown): string =>
  isRecord(body) && typeof body.error === 'string'
    ? body.error
    : 'operation_failed';
