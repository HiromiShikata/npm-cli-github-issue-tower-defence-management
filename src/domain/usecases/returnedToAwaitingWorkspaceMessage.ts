export const RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD =
  'Auto Status Check: RETURNED_TO_AWAITING_WORKSPACE';

export const RETURNED_TO_AWAITING_WORKSPACE_MESSAGE = `${RETURNED_TO_AWAITING_WORKSPACE_MESSAGE_HEAD}
The last report declared that this task needs no pull request, so the task returns to the workspace queue to run under the agent its label selects. A later report carrying the same declaration takes the awaiting quality check path instead of returning here again.`;
