"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIntmux = exports.handleTriage = exports.handleReview = exports.IN_TMUX_BY_HUMAN_STATUS_NAME = exports.AWAITING_WORKSPACE_STATUS_NAME = void 0;
const consoleDoneStore_1 = require("./consoleDoneStore");
exports.AWAITING_WORKSPACE_STATUS_NAME = 'awaiting workspace';
exports.IN_TMUX_BY_HUMAN_STATUS_NAME = 'in tmux by human';
const ok = () => ({
    statusCode: 200,
    body: { ok: true },
});
const badRequest = (message) => ({
    statusCode: 400,
    body: { error: message },
});
const isNonEmptyString = (value) => typeof value === 'string' && value.length > 0;
const resolveStatusId = (project, statusName) => {
    const lower = statusName.toLowerCase();
    const match = project.status.statuses.find((option) => option.name.toLowerCase() === lower);
    return match ? match.id : null;
};
const loadIssueWithProjectItemId = async (context, issueUrl, projectItemId) => {
    const issue = await context.issueRepository.get(issueUrl, context.project);
    if (issue === null) {
        return null;
    }
    return { ...issue, itemId: projectItemId };
};
const recordDone = (context, projectItemId) => {
    if (context.consoleDataOutputDir === null || context.pjcode === null) {
        return;
    }
    (0, consoleDoneStore_1.recordDoneProjectItemIdAcrossTabs)(context.consoleDataOutputDir, context.pjcode, projectItemId);
};
const updateStatusByName = async (context, issueUrl, projectItemId, statusName) => {
    const statusId = resolveStatusId(context.project, statusName);
    if (statusId === null) {
        return badRequest(`status option "${statusName}" not found in project`);
    }
    const issue = await loadIssueWithProjectItemId(context, issueUrl, projectItemId);
    if (issue === null) {
        return badRequest('issue not found');
    }
    await context.issueRepository.updateStatus(context.project, issue, statusId);
    return null;
};
const handleReview = async (context, body) => {
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
        const failure = await updateStatusByName(context, prUrl, projectItemId, exports.AWAITING_WORKSPACE_STATUS_NAME);
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
        await context.issueRepository.requestChangesWithInlineComment(prUrl, changedFilePath, commentBody);
        const failure = await updateStatusByName(context, prUrl, projectItemId, exports.AWAITING_WORKSPACE_STATUS_NAME);
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
exports.handleReview = handleReview;
const handleTriage = async (context, body) => {
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
        const failure = await updateStatusByName(context, issueUrl, projectItemId, statusName);
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
        const issue = await loadIssueWithProjectItemId(context, issueUrl, projectItemId);
        if (issue === null) {
            return badRequest('issue not found');
        }
        await context.issueRepository.updateStory({ ...context.project, story: context.project.story }, issue, storyOptionId);
        recordDone(context, projectItemId);
        return ok();
    }
    if (action === 'close') {
        await context.issueRepository.closePullRequest(issueUrl);
        if (isNonEmptyString(body.commentBody)) {
            await context.issueRepository.createCommentByUrl(issueUrl, body.commentBody);
        }
        recordDone(context, projectItemId);
        return ok();
    }
    if (action === 'snooze_1day' || action === 'snooze_1week') {
        const days = action === 'snooze_1day' ? 1 : 7;
        const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        await context.issueRepository.updateNextActionDate(issueUrl, context.project, target);
        recordDone(context, projectItemId);
        return ok();
    }
    return badRequest(`unknown triage action "${action}"`);
};
exports.handleTriage = handleTriage;
const handleIntmux = async (context, body) => {
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
    const failure = await updateStatusByName(context, issueUrl, projectItemId, exports.IN_TMUX_BY_HUMAN_STATUS_NAME);
    if (failure !== null) {
        return failure;
    }
    recordDone(context, projectItemId);
    return ok();
};
exports.handleIntmux = handleIntmux;
//# sourceMappingURL=consoleOperationApi.js.map