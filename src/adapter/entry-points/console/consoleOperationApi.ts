import {
  IssueRepository,
  PullRequestReviewCommentSide,
} from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { recordDoneProjectItemIdAcrossTabs } from './consoleDoneStore';

export const AWAITING_WORKSPACE_STATUS_NAME = 'awaiting workspace';
export const IN_TMUX_BY_HUMAN_STATUS_NAME = 'in tmux by human';

export type ConsoleProjectBinding = {
  pjcode: string;
  project: Project;
};

export type ConsoleProjectResolver = (
  pjcode: string,
) => Promise<ConsoleProjectBinding | null>;

export type ConsolePjcodeValidator = (pjcode: string) => boolean;

export type ConsoleOperationContext = {
  issueRepository: IssueRepository;
  resolveProject: ConsoleProjectResolver;
  isPjcodeConfigured: ConsolePjcodeValidator;
  consoleDataOutputDir: string | null;
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
): value is ConsoleOperationResponse =>
  Object.prototype.hasOwnProperty.call(value, 'statusCode');

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
    await context.issueRepository.closePullRequest(prUrl);
    if (isNonEmptyString(body.commentBody)) {
      await context.issueRepository.createCommentByUrl(prUrl, body.commentBody);
    }
    recordDone(context, pjcodeResult, projectItemId);
    return ok();
  }

  const binding = await resolveBinding(context, body);
  if (isOperationResponse(binding)) {
    return binding;
  }
  const { project, pjcode } = binding;

  if (action === 'approve') {
    await context.issueRepository.approvePullRequest(prUrl);
    const failure = await updateStatusByName(
      context.issueRepository,
      project,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, pjcode, projectItemId);
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
    await context.issueRepository.requestChangesWithInlineComment(
      prUrl,
      changedFilePath,
      commentBody,
      inlineCommentLocation,
    );
    const failure = await updateStatusByName(
      context.issueRepository,
      project,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, pjcode, projectItemId);
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
      await context.issueRepository.createCommentByUrl(
        issueUrl,
        body.commentBody,
      );
    }
    if (isPullRequestUrl(issueUrl)) {
      await context.issueRepository.closePullRequest(issueUrl);
    } else {
      await context.issueRepository.closeIssueByUrl(
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
      context.issueRepository,
      project,
      issueUrl,
      projectItemId,
      statusName,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, pjcode, projectItemId);
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
    await context.issueRepository.updateStory(
      { ...project, story: project.story },
      projectItemReference(issueUrl, projectItemId),
      storyOptionId,
    );
    recordDone(context, pjcode, projectItemId);
    return ok();
  }

  if (action === 'snooze_1day' || action === 'snooze_1week') {
    const days = action === 'snooze_1day' ? 1 : 7;
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await context.issueRepository.updateNextActionDate(
      issueUrl,
      project,
      target,
      projectItemId,
    );
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
  await context.issueRepository.createCommentByUrl(url, commentBody);
  const comments =
    await context.issueRepository.getIssueOrPullRequestComments(url);
  const posted = comments[comments.length - 1] ?? null;
  return {
    statusCode: 200,
    body: {
      ok: true,
      comment:
        posted === null
          ? { author: '', body: commentBody, createdAt: '' }
          : {
              author: posted.author,
              body: posted.body,
              createdAt: posted.createdAt.toISOString(),
            },
    },
  };
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
    await context.issueRepository.createPullRequestReviewComment(
      url,
      path,
      line,
      side,
      commentBody,
    );
  } catch (error) {
    return badGateway(error instanceof Error ? error.message : 'unknown error');
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
    context.issueRepository,
    project,
    issueUrl,
    projectItemId,
    IN_TMUX_BY_HUMAN_STATUS_NAME,
  );
  if (failure !== null) {
    return failure;
  }
  recordDone(context, pjcode, projectItemId);
  return ok();
};
