import { IssueRepository } from '../../../domain/usecases/adapter-interfaces/IssueRepository';
import { Project } from '../../../domain/entities/Project';
import { Issue } from '../../../domain/entities/Issue';
import { recordDoneProjectItemIdAcrossTabs } from './consoleDoneStore';

export const AWAITING_WORKSPACE_STATUS_NAME = 'awaiting workspace';
export const IN_TMUX_BY_HUMAN_STATUS_NAME = 'in tmux by human';

export type ConsoleOperationContext = {
  issueRepository: IssueRepository;
  project: Project;
  consoleDataOutputDir: string | null;
  pjcode: string | null;
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

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

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

const loadIssueWithProjectItemId = async (
  context: ConsoleOperationContext,
  issueUrl: string,
  projectItemId: string,
): Promise<Issue | null> => {
  const issue = await context.issueRepository.get(issueUrl, context.project);
  if (issue === null) {
    return null;
  }
  return { ...issue, itemId: projectItemId };
};

const recordDone = (
  context: ConsoleOperationContext,
  projectItemId: string,
): void => {
  if (context.consoleDataOutputDir === null || context.pjcode === null) {
    return;
  }
  recordDoneProjectItemIdAcrossTabs(
    context.consoleDataOutputDir,
    context.pjcode,
    projectItemId,
  );
};

const updateStatusByName = async (
  context: ConsoleOperationContext,
  issueUrl: string,
  projectItemId: string,
  statusName: string,
): Promise<ConsoleOperationResponse | null> => {
  const statusId = resolveStatusId(context.project, statusName);
  if (statusId === null) {
    return badRequest(`status option "${statusName}" not found in project`);
  }
  const issue = await loadIssueWithProjectItemId(
    context,
    issueUrl,
    projectItemId,
  );
  if (issue === null) {
    return badRequest('issue not found');
  }
  await context.issueRepository.updateStatus(context.project, issue, statusId);
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

  if (action === 'approve') {
    await context.issueRepository.approvePullRequest(prUrl);
    const failure = await updateStatusByName(
      context,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, projectItemId);
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
    await context.issueRepository.requestChangesWithInlineComment(
      prUrl,
      changedFilePath,
      commentBody,
    );
    const failure = await updateStatusByName(
      context,
      prUrl,
      projectItemId,
      AWAITING_WORKSPACE_STATUS_NAME,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, projectItemId);
    return ok();
  }

  if (action === 'close') {
    await context.issueRepository.closePullRequest(prUrl);
    if (isNonEmptyString(body.commentBody)) {
      await context.issueRepository.createCommentByUrl(prUrl, body.commentBody);
    }
    recordDone(context, projectItemId);
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

  if (action === 'set_status') {
    const statusName = body.statusName;
    if (!isNonEmptyString(statusName)) {
      return badRequest('statusName is required for set_status');
    }
    const failure = await updateStatusByName(
      context,
      issueUrl,
      projectItemId,
      statusName,
    );
    if (failure !== null) {
      return failure;
    }
    recordDone(context, projectItemId);
    return ok();
  }

  if (action === 'set_story') {
    const storyOptionId = body.storyOptionId;
    if (!isNonEmptyString(storyOptionId)) {
      return badRequest('storyOptionId is required for set_story');
    }
    if (context.project.story === null) {
      return badRequest('project does not have a story field');
    }
    const issue = await loadIssueWithProjectItemId(
      context,
      issueUrl,
      projectItemId,
    );
    if (issue === null) {
      return badRequest('issue not found');
    }
    await context.issueRepository.updateStory(
      { ...context.project, story: context.project.story },
      issue,
      storyOptionId,
    );
    recordDone(context, projectItemId);
    return ok();
  }

  if (action === 'close') {
    await context.issueRepository.closePullRequest(issueUrl);
    if (isNonEmptyString(body.commentBody)) {
      await context.issueRepository.createCommentByUrl(
        issueUrl,
        body.commentBody,
      );
    }
    recordDone(context, projectItemId);
    return ok();
  }

  if (action === 'snooze_1day' || action === 'snooze_1week') {
    const days = action === 'snooze_1day' ? 1 : 7;
    const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await context.issueRepository.updateNextActionDate(
      issueUrl,
      context.project,
      target,
    );
    recordDone(context, projectItemId);
    return ok();
  }

  return badRequest(`unknown triage action "${action}"`);
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
  const failure = await updateStatusByName(
    context,
    issueUrl,
    projectItemId,
    IN_TMUX_BY_HUMAN_STATUS_NAME,
  );
  if (failure !== null) {
    return failure;
  }
  recordDone(context, projectItemId);
  return ok();
};
