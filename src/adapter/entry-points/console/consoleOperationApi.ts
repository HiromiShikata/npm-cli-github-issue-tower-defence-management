import type { Issue } from '../../../domain/entities/Issue';
import {
  buildStoryListWithNew,
  FIELD_OPTION_COLORS,
  type FieldOption,
  type Project,
} from '../../../domain/entities/Project';
import type { IssueAttachmentRepository } from '../../../domain/usecases/adapter-interfaces/IssueAttachmentRepository';
import type {
  IssueRepository,
  PullRequestReviewCommentSide,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import type { ProjectRepository } from '../../../domain/usecases/adapter-interfaces/ProjectRepository';
import {
  CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
  CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
  recordDoneProjectItemIdAcrossTabs,
  recordDoneProjectItemIdForTabs,
} from './consoleDoneStore';
import { extractProjectOwner } from './consoleGithubTokenResolver';
import { findConsoleItemUrl } from './consoleItemUrlLookup';
import {
  deleteProjectTimer,
  writeProjectTimer,
} from './consoleProjectTimerStore';
import {
  fetchProjectReadme,
  setProjectReadmeMaxPreparingIssuesCount,
  updateProjectV2Readme,
} from '../cli/projectConfig';

export const AWAITING_WORKSPACE_STATUS_NAME = 'awaiting workspace';
export const PREPARATION_STATUS_NAME = 'preparation';
export const CONFLICT_RETURNED_MESSAGE =
  'Auto Status Check: CONFLICT\nThis pull request has a merge conflict and has been returned to Awaiting Workspace.';
export const IN_TMUX_BY_HUMAN_STATUS_NAME = 'in tmux by human';
export const CHORE_LABEL_NAME = 'chore';

export type ConsoleProjectBinding = {
  pjcode: string;
  project: Project;
};

export type ConsoleProjectResolver = (
  pjcode: string,
) => Promise<ConsoleProjectBinding | null>;

export type ConsolePjcodeValidator = (pjcode: string) => boolean;

export type ConsoleIssueRepositoryResolver = (
  issueOrPullRequestUrl: string,
) => IssueRepository;

export type ConsoleProjectRepositoryResolver = (
  projectUrl: string,
) => Pick<ProjectRepository, 'updateStoryList' | 'getProject'>;

export type ConsoleOperationContext = {
  resolveIssueRepository: ConsoleIssueRepositoryResolver;
  resolveProject: ConsoleProjectResolver;
  isPjcodeConfigured: ConsolePjcodeValidator;
  consoleDataOutputDir: string | null;
  issueAttachmentRepository: IssueAttachmentRepository | null;
  resolveProjectRepository: ConsoleProjectRepositoryResolver | null;
  invalidateProject: ((pjcode: string) => void) | null;
  updateProjectCacheEntry:
    ((pjcode: string, updatedProject: Project) => void) | null;
  patchItemIntoQueuedTab:
    | ((
        pjcode: string,
        projectItemId: string,
        canonicalStatusName: string,
      ) => void)
    | null;
};

export type ConsoleOperationResponse = {
  statusCode: number;
  body: unknown;
};

const ok = (): ConsoleOperationResponse => ({
  statusCode: 200,
  body: { ok: true },
});

const badRequest = (message: string): ConsoleOperationResponse => ({
  statusCode: 400,
  body: { error: message },
});

const badGateway = (message: string): ConsoleOperationResponse => ({
  statusCode: 502,
  body: { error: message },
});

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isPullRequestUrl = (url: string): boolean =>
  /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(url);

const isValidIssueOrPullRequestUrl = (url: string): boolean =>
  /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/(issues|pull)\/\d+$/.test(
    url,
  );

const isReviewCommentSide = (
  value: unknown,
): value is PullRequestReviewCommentSide =>
  value === 'LEFT' || value === 'RIGHT';

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const resolveStatusId = (
  project: Project,
  statusName: string,
): string | null => {
  const lower = statusName.toLowerCase();
  const match = project.status.statuses.find(
    (option) => option.name.toLowerCase() === lower,
  );
  return match ? match.id : null;
};

// Builds the minimal Issue reference the ProjectV2 mutations need. The dashboard
// already supplies the project item id in the request body, and updateStatus,
// updateStory and updateNextActionHour read only `issue.itemId` (plus `url` for
// context). Constructing the reference locally avoids the GraphQL
// fetchProjectItemByUrl call that issueRepository.get would otherwise perform.
const projectItemReference = (
  issueUrl: string,
  projectItemId: string,
): Issue => ({
  nameWithOwner: '',
  number: 0,
  title: '',
  state: 'OPEN',
  status: null,
  story: null,
  nextActionDate: null,
  nextActionHour: null,
  estimationMinutes: null,
  dependedIssueUrls: [],
  completionDate50PercentConfidence: null,
  url: issueUrl,
  assignees: [],
  labels: [],
  org: '',
  repo: '',
  body: '',
  itemId: projectItemId,
  isPr: isPullRequestUrl(issueUrl),
  isInProgress: false,
  isClosed: false,
  createdAt: new Date(0),
  author: '',
  closingIssueReferenceUrls: [],
  agent: null,
  stateReason: null,
});

const recordDone = (
  context: ConsoleOperationContext,
  pjcode: string,
  projectItemId: string,
): void => {
  if (context.consoleDataOutputDir === null) {
    return;
  }
  recordDoneProjectItemIdAcrossTabs(
    context.consoleDataOutputDir,
    pjcode,
    projectItemId,
  );
};

const recordDoneForStatusChange = (
  context: ConsoleOperationContext,
  pjcode: string,
  projectItemId: string,
): void => {
  if (context.consoleDataOutputDir === null) {
    return;
  }
  recordDoneProjectItemIdForTabs(
    context.consoleDataOutputDir,
    pjcode,
    projectItemId,
    CONSOLE_DONE_STATUS_SELECTED_TAB_NAMES,
  );
};

const recordDoneForStoryChange = (
  context: ConsoleOperationContext,
  pjcode: string,
  projectItemId: string,
): void => {
  if (context.consoleDataOutputDir === null) {
    return;
  }
  recordDoneProjectItemIdForTabs(
    context.consoleDataOutputDir,
    pjcode,
    projectItemId,
    CONSOLE_DONE_STORY_SELECTED_TAB_NAMES,
  );
};

const resolveBinding = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleProjectBinding | ConsoleOperationResponse> => {
  const pjcode = body.pjcode;
  if (!isNonEmptyString(pjcode)) {
    return badRequest('pjcode is required');
  }
  const binding = await context.resolveProject(pjcode);
  if (binding === null) {
    return badRequest(`no project configured for pjcode "${pjcode}"`);
  }
  return binding;
};

const isOperationResponse = (
  value: ConsoleProjectBinding | ConsoleOperationResponse,
): value is ConsoleOperationResponse => Object.hasOwn(value, 'statusCode');

// Validates that a pjcode is configured WITHOUT loading the ProjectV2 via
// GraphQL. Close operations only need the pjcode (for recordDone namespacing)
// and the issue/PR URL, both of which are handled through REST. Loading the
// full project here would make close fail whenever the GraphQL quota is
// exhausted, even though closing a GitHub issue or PR needs only REST.
const resolveConfiguredPjcode = (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): string | ConsoleOperationResponse => {
  const pjcode = body.pjcode;
  if (!isNonEmptyString(pjcode)) {
    return badRequest('pjcode is required');
  }
  if (!context.isPjcodeConfigured(pjcode)) {
    return badRequest(`no project configured for pjcode "${pjcode}"`);
  }
  return pjcode;
};

const updateStatusByName = async (
  issueRepository: IssueRepository,
  project: Project,
  issueUrl: string,
  projectItemId: string,
  statusName: string,
): Promise<ConsoleOperationResponse | null> => {
  const statusId = resolveStatusId(project, statusName);
  if (statusId === null) {
    return badRequest(`status option "${statusName}" not found in project`);
  }
  await issueRepository.updateStatus(
    project,
    projectItemReference(issueUrl, projectItemId),
    statusId,
  );
  return null;
};

const addChoreLabel = async (
  issueRepository: IssueRepository,
  issueUrl: string,
): Promise<ConsoleOperationResponse | null> => {
  const issue = await issueRepository.getIssueByUrl(issueUrl);
  if (issue === null) {
    return badGateway(`issue "${issueUrl}" could not be loaded`);
  }
  if (issue.labels.includes(CHORE_LABEL_NAME)) {
    return null;
  }
  await issueRepository.updateLabels(issue, [
    ...issue.labels,
    CHORE_LABEL_NAME,
  ]);
  return null;
};

export const handleReview = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const action = body.action;
  const prUrl = body.prUrl;
  const projectItemId = body.projectItemId;
  if (!isNonEmptyString(action)) {
    return badRequest('action is required');
  }
  if (!isNonEmptyString(prUrl)) {
    return badRequest('prUrl is required');
  }
  if (!isNonEmptyString(projectItemId)) {
    return badRequest('projectItemId is required');
  }

  if (action === 'close') {
    const pjcodeResult = resolveConfiguredPjcode(context, body);
    if (typeof pjcodeResult !== 'string') {
      return pjcodeResult;
    }
    await context.resolveIssueRepository(prUrl).closePullRequest(prUrl);
    if (isNonEmptyString(body.commentBody)) {
      await context
        .resolveIssueRepository(prUrl)
        .createCommentByUrl(prUrl, body.commentBody);
    }
    const issueUrl = body.issueUrl;
    if (isNonEmptyString(issueUrl)) {
      const binding = await context.resolveProject(pjcodeResult);
      if (binding === null) {
        return badRequest(`no project configured for pjcode "${pjcodeResult}"`);
      }
      const statusFailure = await updateStatusByName(
        context.resolveIssueRepository(issueUrl),
        binding.project,
        issueUrl,
        projectItemId,
        AWAITING_WORKSPACE_STATUS_NAME,
      );
      if (statusFailure !== null) {
        return statusFailure;
      }
    }
    recordDone(context, pjcodeResult, projectItemId);
    return ok();
  }

  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project, pjcode } = binding;

  if (action === 'unnecessary') {
    const issueUrl = body.issueUrl;
    if (!isNonEmptyString(issueUrl)) {
      return badRequest('issueUrl is required for unnecessary');
    }
    await context.resolveIssueRepository(prUrl).closePullRequest(prUrl);
    if (isNonEmptyString(body.commentBody)) {
      await context
        .resolveIssueRepository(prUrl)
        .createCommentByUrl(prUrl, body.commentBody);
    }
    if (isNonEmptyString(body.issueCommentBody)) {
      await context
        .resolveIssueRepository(issueUrl)
        .createCommentByUrl(issueUrl, body.issueCommentBody);
    }
    const labelFailure = await addChoreLabel(
      context.resolveIssueRepository(issueUrl),
      issueUrl,
    );
    if (labelFailure !== null) {
      return labelFailure;
    }
    const failure = await updateStatusByName(
      context.resolveIssueRepository(issueUrl),
      project,
      issueUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, pjcode, projectItemId);
    return ok();
  }

  if (action === 'approve_and_merge') {
    const issueRepository = context.resolveIssueRepository(prUrl);
    const prStatus = await issueRepository.getOpenPullRequest(prUrl);
    if (prStatus === null) {
      return badRequest(
        'Cannot merge: pull request not found or already closed',
      );
    }
    if (prStatus.isConflicted) {
      await issueRepository.createCommentByUrl(
        prUrl,
        CONFLICT_RETURNED_MESSAGE,
      );
      const conflictFailure = await updateStatusByName(
        issueRepository,
        project,
        prUrl,
        projectItemId,
        AWAITING_WORKSPACE_STATUS_NAME,
      );
      if (conflictFailure !== null) {
        return conflictFailure;
      }
      recordDoneForStatusChange(context, pjcode, projectItemId);
      return ok();
    }
    if (!prStatus.isPassedAllCiJob) {
      const missing = prStatus.missingRequiredCheckNames;
      const detail = missing.length > 0 ? `: ${missing.join(', ')}` : '';
      return badRequest(`Cannot merge: required checks are not green${detail}`);
    }
    const prDetail = await issueRepository.getPullRequestDetail(prUrl);
    const authenticatedUser = await issueRepository.getAuthenticatedUserLogin();
    const isSelfAuthored =
      prDetail !== null && prDetail.author === authenticatedUser;
    if (!isSelfAuthored) {
      try {
        await issueRepository.approvePullRequest(prUrl);
      } catch (error) {
        if (!(error instanceof Error && error.message.includes('HTTP 422'))) {
          throw error;
        }
      }
    }
    try {
      await issueRepository.mergePullRequest(prUrl);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('403') &&
        error.message.toLowerCase().includes('workflow')
      ) {
        return badRequest(
          `Cannot merge: this pull request modifies workflow files and the configured token lacks 'workflow' scope. Please merge this pull request manually.`,
        );
      }
      throw error;
    }
    const failure = await updateStatusByName(
      issueRepository,
      project,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDoneForStatusChange(context, pjcode, projectItemId);
    return ok();
  }

  if (action === 'request_changes') {
    const commentBody = body.commentBody;
    if (!isNonEmptyString(commentBody)) {
      return badRequest('commentBody is required for request_changes');
    }
    const changedFilePath = isNonEmptyString(body.changedFilePath)
      ? body.changedFilePath
      : null;
    const inlineCommentLocation =
      changedFilePath !== null &&
      isPositiveInteger(body.line) &&
      isReviewCommentSide(body.side)
        ? { line: body.line, side: body.side }
        : null;
    await context
      .resolveIssueRepository(prUrl)
      .requestChangesWithInlineComment(
        prUrl,
        changedFilePath,
        commentBody,
        inlineCommentLocation,
      );
    const failure = await updateStatusByName(
      context.resolveIssueRepository(prUrl),
      project,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDoneForStatusChange(context, pjcode, projectItemId);
    return ok();
  }

  return badRequest(`unknown review action "${action}"`);
};

export const handleTriage = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const action = body.action;
  const issueUrl = body.issueUrl;
  const projectItemId = body.projectItemId;
  if (!isNonEmptyString(action)) {
    return badRequest('action is required');
  }
  if (!isNonEmptyString(issueUrl)) {
    return badRequest('issueUrl is required');
  }
  if (!isNonEmptyString(projectItemId)) {
    return badRequest('projectItemId is required');
  }

  if (action === 'close' || action === 'close_not_planned') {
    const pjcodeResult = resolveConfiguredPjcode(context, body);
    if (typeof pjcodeResult !== 'string') {
      return pjcodeResult;
    }
    if (isNonEmptyString(body.commentBody)) {
      await context
        .resolveIssueRepository(issueUrl)
        .createCommentByUrl(issueUrl, body.commentBody);
    }
    if (isPullRequestUrl(issueUrl)) {
      await context.resolveIssueRepository(issueUrl).closePullRequest(issueUrl);
    } else {
      await context
        .resolveIssueRepository(issueUrl)
        .closeIssueByUrl(
          issueUrl,
          action === 'close_not_planned' ? 'not_planned' : 'completed',
        );
    }
    recordDone(context, pjcodeResult, projectItemId);
    return ok();
  }

  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project, pjcode } = binding;

  if (action === 'set_status') {
    const statusName = body.statusName;
    if (!isNonEmptyString(statusName)) {
      return badRequest('statusName is required for set_status');
    }
    const failure = await updateStatusByName(
      context.resolveIssueRepository(issueUrl),
      project,
      issueUrl,
      projectItemId,
      statusName,
    );
    if (failure !== null) {
      return failure;
    }
    recordDoneForStatusChange(context, pjcode, projectItemId);
    const lowerStatus = statusName.toLowerCase();
    if (
      lowerStatus === AWAITING_WORKSPACE_STATUS_NAME ||
      lowerStatus === PREPARATION_STATUS_NAME
    ) {
      const canonicalStatusName =
        project.status.statuses.find(
          (o) => o.name.toLowerCase() === lowerStatus,
        )?.name ?? statusName;
      context.patchItemIntoQueuedTab?.(
        pjcode,
        projectItemId,
        canonicalStatusName,
      );
    }
    return ok();
  }

  if (action === 'set_story') {
    const storyOptionId = body.storyOptionId;
    if (!isNonEmptyString(storyOptionId)) {
      return badRequest('storyOptionId is required for set_story');
    }
    if (project.story === null) {
      return badRequest('project does not have a story field');
    }
    await context
      .resolveIssueRepository(issueUrl)
      .updateStory(
        { ...project, story: project.story },
        projectItemReference(issueUrl, projectItemId),
        storyOptionId,
      );
    recordDoneForStoryChange(context, pjcode, projectItemId);
    return ok();
  }

  if (action === 'snooze_1hour' || action === 'snooze_3hours') {
    if (project.nextActionHour === null) {
      return badRequest('project does not have a nextActionHour field');
    }
    const hoursToAdd = action === 'snooze_1hour' ? 1 : 3;
    const now = Date.now();
    const rawHour = new Date(now).getUTCHours() + hoursToAdd;
    const crossesMidnight = rawHour >= 24;
    const targetHour = crossesMidnight ? rawHour - 24 : rawHour;
    const issueRepo = context.resolveIssueRepository(issueUrl);
    await issueRepo.updateNextActionHour(
      { ...project, nextActionHour: project.nextActionHour },
      projectItemReference(issueUrl, projectItemId),
      targetHour,
    );
    if (crossesMidnight) {
      const tomorrow = new Date(now);
      tomorrow.setUTCHours(0, 0, 0, 0);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      await issueRepo.updateNextActionDate(
        issueUrl,
        project,
        tomorrow,
        projectItemId,
      );
    }
    recordDone(context, pjcode, projectItemId);
    return ok();
  }

  if (action === 'snooze_1day' || action === 'snooze_1week') {
    const days = action === 'snooze_1day' ? 1 : 7;
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await context
      .resolveIssueRepository(issueUrl)
      .updateNextActionDate(issueUrl, project, target, projectItemId);
    recordDone(context, pjcode, projectItemId);
    return ok();
  }

  return badRequest(`unknown triage action "${action}"`);
};

export const handleComment = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const url = body.url;
  const commentBody = body.body;
  if (!isNonEmptyString(url)) {
    return badRequest('url is required');
  }
  if (!isNonEmptyString(commentBody)) {
    return badRequest('body is required');
  }
  const posted = await context
    .resolveIssueRepository(url)
    .createCommentByUrl(url, commentBody);
  return {
    statusCode: 200,
    body: {
      ok: true,
      comment: {
        author: posted.author,
        body: posted.body,
        createdAt: posted.createdAt.toISOString(),
      },
    },
  };
};

export const handleAttachmentUpload = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const url = body.url;
  const fileName = body.fileName;
  const contentBase64 = body.contentBase64;
  if (!isNonEmptyString(url)) {
    return badRequest('url is required');
  }
  if (!isValidIssueOrPullRequestUrl(url)) {
    return badRequest('url must be a github issue or pull request url');
  }
  if (!isNonEmptyString(fileName)) {
    return badRequest('fileName is required');
  }
  if (!isNonEmptyString(contentBase64)) {
    return badRequest('contentBase64 is required');
  }
  const pjcodeResult = resolveConfiguredPjcode(context, body);
  if (typeof pjcodeResult !== 'string') {
    return pjcodeResult;
  }
  if (context.consoleDataOutputDir === null) {
    return badGateway('console data output dir is not configured');
  }
  const knownUrl = findConsoleItemUrl(
    context.consoleDataOutputDir,
    pjcodeResult,
    url,
  );
  if (knownUrl === null) {
    return badRequest('url is not a console item of this project');
  }
  if (context.issueAttachmentRepository === null) {
    return badGateway('attachment upload is not configured');
  }
  const markdown = await context.issueAttachmentRepository.uploadAttachment({
    issueOrPullRequestUrl: knownUrl,
    fileName,
    content: Buffer.from(contentBase64, 'base64'),
  });
  return {
    statusCode: 200,
    body: { ok: true, markdown },
  };
};

export const handleCreateIssue = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const title = body.title;
  const storyOptionId = body.storyOptionId;
  const nameWithOwner = body.nameWithOwner;
  if (!isNonEmptyString(title)) {
    return badRequest('title is required');
  }
  if (!isNonEmptyString(storyOptionId)) {
    return badRequest('storyOptionId is required');
  }
  if (!isNonEmptyString(nameWithOwner)) {
    return badRequest('nameWithOwner is required');
  }
  const slashIndex = nameWithOwner.indexOf('/');
  if (slashIndex <= 0 || slashIndex === nameWithOwner.length - 1) {
    return badRequest('nameWithOwner must be in owner/repo format');
  }
  const org = nameWithOwner.slice(0, slashIndex);
  const repo = nameWithOwner.slice(slashIndex + 1);

  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project } = binding;

  if (project.story === null) {
    return badRequest('project does not have a story field');
  }
  const storyOption = project.story.stories.find((s) => s.id === storyOptionId);
  if (storyOption === undefined) {
    return badRequest(`story option "${storyOptionId}" not found in project`);
  }

  const proxyUrl = `https://github.com/${nameWithOwner}/issues/0`;
  const issueRepository = context.resolveIssueRepository(proxyUrl);
  const issueNumber = await issueRepository.createNewIssue(
    org,
    repo,
    title,
    '',
    [],
    [],
  );
  const issueUrl = `https://github.com/${nameWithOwner}/issues/${issueNumber}`;

  await issueRepository.addIssueToProject(project, issueUrl);

  const addedIssue = await issueRepository.get(issueUrl, project);
  if (addedIssue !== null) {
    await issueRepository.updateStory(
      { ...project, story: project.story },
      addedIssue,
      storyOptionId,
    );
  }

  return { statusCode: 200, body: { ok: true, issueUrl } };
};

export const handleReviewComment = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const url = body.url;
  const path = body.path;
  const line = body.line;
  const side = body.side;
  const commentBody = body.body;
  if (!isNonEmptyString(url)) {
    return badRequest('url is required');
  }
  if (!isNonEmptyString(path)) {
    return badRequest('path is required');
  }
  if (!isPositiveInteger(line)) {
    return badRequest('line must be a positive integer');
  }
  if (!isReviewCommentSide(side)) {
    return badRequest('side must be "LEFT" or "RIGHT"');
  }
  if (!isNonEmptyString(commentBody)) {
    return badRequest('body is required');
  }
  try {
    await context
      .resolveIssueRepository(url)
      .createPullRequestReviewComment(url, path, line, side, commentBody);
  } catch (error) {
    return badGateway(error instanceof Error ? error.message : 'unknown error');
  }
  return ok();
};

const isStoryColor = (value: unknown): value is FieldOption['color'] =>
  FIELD_OPTION_COLORS.some((c) => c === value);

export const handleStoryColor = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const storyOptionId = body.storyOptionId;
  const newColor = body.newColor;
  const nameWithOwner = body.nameWithOwner;

  if (!isNonEmptyString(storyOptionId)) {
    return badRequest('storyOptionId is required');
  }
  if (!isStoryColor(newColor)) {
    return badRequest(
      'newColor must be one of GRAY, BLUE, GREEN, YELLOW, ORANGE, RED, PINK, PURPLE',
    );
  }
  if (!isNonEmptyString(nameWithOwner)) {
    return badRequest('nameWithOwner is required');
  }

  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project, pjcode } = binding;

  if (project.story === null) {
    return badRequest('project does not have a story field');
  }

  const storyOption = project.story.stories.find((s) => s.id === storyOptionId);
  if (storyOption === undefined) {
    return badRequest(`story option "${storyOptionId}" not found in project`);
  }

  if (context.resolveProjectRepository === null) {
    return badGateway('project repository is not configured');
  }

  const projectRepository = context.resolveProjectRepository(project.url);
  const freshProject = await projectRepository.getProject(project.id);
  const freshStory = freshProject?.story ?? project.story;
  const projectWithFreshStory = {
    ...(freshProject ?? project),
    story: freshStory,
  };

  const proxyUrl = `https://github.com/${nameWithOwner}/issues/0`;
  await context
    .resolveIssueRepository(proxyUrl)
    .updateStoryOptionColor(projectWithFreshStory, storyOptionId, newColor);

  if (context.updateProjectCacheEntry !== null) {
    const updatedStories = freshStory.stories.map((s) =>
      s.id === storyOptionId ? { ...s, color: newColor } : s,
    );
    const updatedProject: Project = {
      ...projectWithFreshStory,
      story: { ...freshStory, stories: updatedStories },
    };
    context.updateProjectCacheEntry(pjcode, updatedProject);
  }

  return ok();
};

export const handleIntmux = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const action = body.action;
  const issueUrl = body.issueUrl;
  const projectItemId = body.projectItemId;
  if (!isNonEmptyString(action)) {
    return badRequest('action is required');
  }
  if (action !== 'set_intmux') {
    return badRequest(`unknown intmux action "${action}"`);
  }
  if (!isNonEmptyString(issueUrl)) {
    return badRequest('issueUrl is required');
  }
  if (!isNonEmptyString(projectItemId)) {
    return badRequest('projectItemId is required');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project, pjcode } = binding;
  const failure = await updateStatusByName(
    context.resolveIssueRepository(issueUrl),
    project,
    issueUrl,
    projectItemId,
    IN_TMUX_BY_HUMAN_STATUS_NAME,
  );
  if (failure !== null) {
    return failure;
  }
  recordDoneForStatusChange(context, pjcode, projectItemId);
  return ok();
};

export const handleReorderStory = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const pjcode = body.pjcode;
  const storyOptionId = body.storyOptionId;
  const direction = body.direction;
  if (!isNonEmptyString(pjcode)) {
    return badRequest('pjcode is required');
  }
  if (!isNonEmptyString(storyOptionId)) {
    return badRequest('storyOptionId is required');
  }
  if (direction !== 'up' && direction !== 'down') {
    return badRequest('direction must be "up" or "down"');
  }
  if (context.resolveProjectRepository === null) {
    return badGateway('project repository is not configured');
  }
  const binding = await context.resolveProject(pjcode);
  if (binding === null) {
    return badRequest(`no project configured for pjcode "${pjcode}"`);
  }
  const { project } = binding;
  if (project.story === null) {
    return badRequest('project does not have a story field');
  }
  const cachedStories = project.story.stories;
  const cachedIndex = cachedStories.findIndex((s) => s.id === storyOptionId);
  if (cachedIndex === -1) {
    return badRequest('story option not found');
  }
  const cachedSwapIndex = cachedIndex + (direction === 'up' ? -1 : 1);
  if (cachedSwapIndex < 0 || cachedSwapIndex >= cachedStories.length) {
    return badRequest('cannot move in that direction');
  }
  const projectRepository = context.resolveProjectRepository(project.url);
  const freshProject = await projectRepository.getProject(project.id);
  const stories = freshProject?.story?.stories ?? cachedStories;
  const index = stories.findIndex((s) => s.id === storyOptionId);
  const targetIndex = index !== -1 ? index : cachedIndex;
  const swapIndex = targetIndex + (direction === 'up' ? -1 : 1);
  const reordered = [...stories];
  if (swapIndex < 0 || swapIndex >= reordered.length) {
    return badRequest('cannot move in that direction');
  }
  const temp = reordered[targetIndex];
  reordered[targetIndex] = reordered[swapIndex];
  reordered[swapIndex] = temp;
  await projectRepository.updateStoryList(project, reordered);
  context.invalidateProject?.(pjcode);
  return ok();
};

export const handleStoryAdd = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  if (context.resolveProjectRepository === null) {
    return badGateway('project repository is not configured');
  }
  const storyName = body.storyName;
  if (!isNonEmptyString(storyName)) {
    return badRequest('storyName is required');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { pjcode, project } = binding;
  if (project.story === null) {
    return badRequest('project does not have a story field');
  }
  const projectRepository = context.resolveProjectRepository(project.url);
  const freshProject = await projectRepository.getProject(project.id);
  const freshStories = freshProject?.story?.stories ?? project.story.stories;
  const newStoryList = buildStoryListWithNew(freshStories, storyName);
  await projectRepository.updateStoryList(project, newStoryList);
  context.invalidateProject?.(pjcode);
  return ok();
};

export const handleSetDependedIssueUrl = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const issueUrl = body.issueUrl;
  const dependedIssueUrl = body.dependedIssueUrl;
  if (!isNonEmptyString(issueUrl)) {
    return badRequest('issueUrl is required');
  }
  if (!isNonEmptyString(dependedIssueUrl)) {
    return badRequest('dependedIssueUrl is required');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project } = binding;
  if (project.dependedIssueUrlSeparatedByComma === null) {
    return badRequest(
      'project does not have a depended issue URL field configured',
    );
  }
  await context
    .resolveIssueRepository(issueUrl)
    .setDependedIssueUrl(issueUrl, project, dependedIssueUrl);
  return ok();
};

export const handleDeleteAllComments = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  const issueUrl = body.issueUrl;
  if (!isNonEmptyString(issueUrl)) {
    return badRequest('issueUrl is required');
  }
  await context
    .resolveIssueRepository(issueUrl)
    .deleteAllCommentsByUrl(issueUrl);
  return ok();
};

export const handleDeleteStory = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  if (context.resolveProjectRepository === null) {
    return badGateway('project repository is not configured');
  }
  const storyOptionId = body.storyOptionId;
  if (!isNonEmptyString(storyOptionId)) {
    return badRequest('storyOptionId is required');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { pjcode, project } = binding;
  if (project.story === null) {
    return badRequest('project does not have a story field');
  }
  const storyOption = project.story.stories.find((s) => s.id === storyOptionId);
  if (storyOption === undefined) {
    return badRequest(`story option "${storyOptionId}" not found in project`);
  }
  if (project.story.workflowManagementStory.id === storyOptionId) {
    return badRequest('cannot delete the workflow management story');
  }
  const projectOwner = extractProjectOwner(project.url);
  if (projectOwner === null) {
    return badGateway('cannot determine project owner from project URL');
  }
  const proxyUrl = `https://github.com/${projectOwner}/${projectOwner}/issues/0`;
  const issueRepository = context.resolveIssueRepository(proxyUrl);
  const storyObjectMap = await issueRepository.getStoryObjectMap(project);
  const storyIssue = storyObjectMap.get(storyOption.name)?.storyIssue ?? null;
  const projectRepository = context.resolveProjectRepository(project.url);
  const freshProject = await projectRepository.getProject(project.id);
  const freshStories = freshProject?.story?.stories ?? project.story.stories;
  const filteredStories = freshStories.filter((s) => s.id !== storyOptionId);
  await projectRepository.updateStoryList(project, filteredStories);
  context.invalidateProject?.(pjcode);
  if (storyIssue !== null) {
    try {
      await issueRepository.closeIssueByUrl(storyIssue.url, 'completed');
    } catch (e) {
      console.error('Failed to close story issue after story deletion:', e);
    }
  }
  const storyTasks = storyObjectMap.get(storyOption.name)?.issues ?? [];
  for (const task of storyTasks) {
    if (!task.isClosed && !task.isPr) {
      try {
        await issueRepository.closeIssueByUrl(task.url, 'not_planned');
      } catch (e) {
        console.error(
          `Failed to close task after story deletion: ${task.url}`,
          e,
        );
      }
    }
  }
  return ok();
};

export const handleStoryRename = async (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  if (context.resolveProjectRepository === null) {
    return badGateway('project repository is not configured');
  }
  const storyOptionId = body.storyOptionId;
  const newName = body.newName;
  if (!isNonEmptyString(storyOptionId)) {
    return badRequest('storyOptionId is required');
  }
  if (!isNonEmptyString(newName)) {
    return badRequest('newName is required');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { pjcode, project } = binding;
  if (project.story === null) {
    return badRequest('project does not have a story field');
  }
  const projectRepository = context.resolveProjectRepository(project.url);
  const freshProject = await projectRepository.getProject(project.id);
  const freshStories = freshProject?.story?.stories ?? project.story.stories;
  const storyOption = freshStories.find((s) => s.id === storyOptionId);
  if (storyOption === undefined) {
    return badRequest(`story option "${storyOptionId}" not found in project`);
  }
  const projectOwner = extractProjectOwner(project.url);
  if (projectOwner === null) {
    return badGateway('cannot determine project owner from project URL');
  }
  const proxyUrl = `https://github.com/${projectOwner}/${projectOwner}/issues/0`;
  const issueRepository = context.resolveIssueRepository(proxyUrl);
  const storyObjectMap = await issueRepository.getStoryObjectMap(project);
  const storyIssue = storyObjectMap.get(storyOption.name)?.storyIssue ?? null;
  const renamedStories = freshStories.map((s) =>
    s.id === storyOptionId ? { ...s, name: newName } : s,
  );
  await projectRepository.updateStoryList(project, renamedStories);
  context.invalidateProject?.(pjcode);
  if (storyIssue !== null) {
    await issueRepository.updateIssue({ ...storyIssue, title: newName });
  }
  return ok();
};

export const handleTimer = (
  context: ConsoleOperationContext,
  body: Record<string, unknown>,
): ConsoleOperationResponse => {
  const pjcode = body.pjcode;
  if (!isNonEmptyString(pjcode)) {
    return badRequest('pjcode is required');
  }
  if (!context.isPjcodeConfigured(pjcode)) {
    return badRequest('pjcode is not configured');
  }
  const consoleDataOutputDir = context.consoleDataOutputDir;
  if (consoleDataOutputDir === null) {
    return badGateway('consoleDataOutputDir is not configured');
  }
  if (body.action === 'stop') {
    deleteProjectTimer(consoleDataOutputDir, pjcode);
    return ok();
  }
  const durationSeconds = body.durationSeconds;
  if (
    typeof durationSeconds !== 'number' ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return badRequest('durationSeconds must be a positive integer');
  }
  writeProjectTimer(consoleDataOutputDir, pjcode, {
    startedAt: new Date().toISOString(),
    durationSeconds,
  });
  return ok();
};

export const handleProjectMaxPreparingUpdate = async (
  context: ConsoleOperationContext,
  githubToken: string | null,
  body: Record<string, unknown>,
): Promise<ConsoleOperationResponse> => {
  if (githubToken === null || githubToken.length === 0) {
    return badGateway('github token is not configured');
  }
  const count = body.maximumPreparingIssuesCount;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
    return badRequest('maximumPreparingIssuesCount must be a positive integer');
  }
  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project } = binding;
  const existingReadme = await fetchProjectReadme(project.url, githubToken);
  const updatedReadme = setProjectReadmeMaxPreparingIssuesCount(
    existingReadme ?? '',
    count,
  );
  try {
    await updateProjectV2Readme(project.id, updatedReadme, githubToken);
  } catch (error) {
    return badGateway(
      error instanceof Error
        ? error.message
        : 'failed to update project README',
    );
  }
  return ok();
};
