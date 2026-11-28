import type { ConsoleCreateIssueRequest } from './consoleApi';

export const CREATE_ISSUE_MAX_ATTEMPTS = 3;
export const CREATE_ISSUE_RETRY_DELAYS_MS = [500, 1000] as const;

export type CreateIssueSender = (
  request: ConsoleCreateIssueRequest,
) => Promise<{ httpStatus: number; body: unknown }>;

export type CreateIssueOutcome =
  | { kind: 'created'; issueUrl: string }
  | {
      kind: 'createdWithIncompleteStep';
      issueUrl: string;
      failedStep: string;
      reason: string;
    }
  | { kind: 'notCreated'; reason: string }
  | { kind: 'unconfirmed'; reason: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const bodyString = (body: Record<string, unknown>, key: string): string =>
  typeof body[key] === 'string' ? body[key] : '';

const reasonFromBody = (body: Record<string, unknown>): string =>
  bodyString(body, 'error') || 'The create-task request failed.';

const outcomeFromResponse = (
  httpStatus: number,
  body: unknown,
): CreateIssueOutcome | null => {
  if (!isRecord(body)) {
    if (httpStatus >= 400 && httpStatus < 500) {
      return { kind: 'notCreated', reason: `HTTP ${httpStatus}` };
    }
    return httpStatus >= 500
      ? {
          kind: 'unconfirmed',
          reason: 'The creation state could not be confirmed.',
        }
      : null;
  }
  const issueUrl = bodyString(body, 'issueUrl');
  if (httpStatus >= 200 && httpStatus < 300 && issueUrl) {
    return { kind: 'created', issueUrl };
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    return { kind: 'notCreated', reason: reasonFromBody(body) };
  }
  if (httpStatus >= 500 && typeof body.issueCreated !== 'boolean') {
    return { kind: 'unconfirmed', reason: reasonFromBody(body) };
  }
  if (httpStatus === 500 && body.issueCreated === true && issueUrl) {
    const failedStep = bodyString(body, 'failedStep');
    if (failedStep) {
      return {
        kind: 'createdWithIncompleteStep',
        issueUrl,
        failedStep,
        reason: reasonFromBody(body),
      };
    }
  }
  if (httpStatus >= 500 && body.issueCreated !== true) {
    return { kind: 'notCreated', reason: reasonFromBody(body) };
  }
  return null;
};

export const createIssueWithRetry = async (
  send: CreateIssueSender,
  request: ConsoleCreateIssueRequest,
  options: { wait?: (milliseconds: number) => Promise<void> } = {},
): Promise<CreateIssueOutcome> => {
  const wait =
    options.wait ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let latestOutcome: CreateIssueOutcome | null = null;
  let latestTransportError: string | null = null;
  let transportFailureAfterResponse = false;
  for (let attempt = 0; attempt < CREATE_ISSUE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await send(request);
      const outcome = outcomeFromResponse(response.httpStatus, response.body);
      if (outcome !== null) {
        latestOutcome = outcome;
        if (response.httpStatus >= 200 && response.httpStatus < 300)
          return outcome;
        if (response.httpStatus >= 400 && response.httpStatus < 500)
          return outcome;
      }
    } catch (error) {
      latestTransportError =
        error instanceof Error ? error.message : String(error);
      if (latestOutcome?.kind === 'notCreated') {
        transportFailureAfterResponse = true;
      }
    }
    if (attempt < CREATE_ISSUE_MAX_ATTEMPTS - 1) {
      await wait(CREATE_ISSUE_RETRY_DELAYS_MS[attempt]);
    }
  }
  if (latestOutcome?.kind === 'notCreated' && transportFailureAfterResponse) {
    return {
      kind: 'unconfirmed',
      reason:
        latestTransportError ?? 'The creation state could not be confirmed.',
    };
  }
  if (latestOutcome !== null) return latestOutcome;
  return {
    kind: 'unconfirmed',
    reason:
      latestTransportError ?? 'The creation state could not be confirmed.',
  };
};
