import { WorkerSessionFailureStreak } from '../entities/WorkerSessionFailureStreak';
import { WorkerSessionFailureStreakRepository } from './adapter-interfaces/WorkerSessionFailureStreakRepository';
import { WorkerSessionLogRepository } from './adapter-interfaces/WorkerSessionLogRepository';
import { isRecord } from './isRecord';

export const WORKER_SESSION_CONSECUTIVE_FAILURE_THRESHOLD = 3;

export type WorkerSessionEndClassifyInput = {
  issueUrl: string;
  sessionLogFilePath: string;
  sessionWasResumed: boolean;
  missingAgentNameReported: boolean;
};

export type WorkerSessionEndClassification = {
  moveToFailedPreparation: boolean;
  rateLimitRejected: boolean;
  promptTooLongOnResume: boolean;
  sessionErrorLine: string | null;
  diagnosticLines: string[];
};

type WorkerSessionLogEnding = {
  finalTerminalLine: string | null;
  terminalReason: string;
  usageLimitEndingFound: boolean;
  rejectedRateLimitEventFound: boolean;
  sessionLimitHttp429Found: boolean;
  assistantToolCallFound: boolean;
};

type WorkerSessionRateLimitRejection = {
  rateLimitRejected: boolean;
  diagnosticLines: string[];
};

type WorkerSessionFailureStreakOutcome = {
  moveToFailedPreparation: boolean;
  sessionErrorLine: string | null;
  diagnosticLines: string[];
};

type WorkerSessionFailureStreakFindResult = {
  storedStreak: WorkerSessionFailureStreak | null;
  diagnosticLines: string[];
};

const TERMINAL_REASON_KEY_TEXT = '"terminal_reason"';
const TERMINAL_REASON_STRING_VALUE_PREFIX_TEXT = '"terminal_reason":"';
const COMPLETED_TERMINAL_REASON = 'completed';
const BLOCKING_LIMIT_TERMINAL_REASON = 'blocking_limit';
const ERROR_RESULT_FLAG_TEXT = '"is_error":true';
const USAGE_LIMIT_RESULT_TEXT_PATTERN = /hit your [A-Za-z0-9 ]+ limit/;
const RATE_LIMIT_EVENT_TYPE_TEXT = '"type":"rate_limit_event"';
const REJECTED_STATUS_TEXT = '"status":"rejected"';
const HTTP_429_API_ERROR_STATUS_TEXT = '"api_error_status":429';
const SESSION_LIMIT_TEXT_PATTERN = /session limit/i;
const TOOL_USE_TYPE_TEXT = '"type":"tool_use"';

const USAGE_LIMIT_ENDING_DETECTED_LINE =
  'usage-limit-ending-detected: consecutive failure counter not incremented';
const RATE_LIMIT_REJECTION_DETECTED_LINE =
  'rate-limit-rejection-detected: consecutive failure counter not incremented';
const FAILURE_STREAK_RESET_LINE =
  'consecutive-same-reason-failure: reset (run succeeded or no terminal_reason)';

const finalLineContaining = (lines: string[], text: string): string | null => {
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    if (lines[lineIndex].includes(text)) {
      return lines[lineIndex];
    }
  }
  return null;
};

const terminalReasonOf = (terminalLine: string): string => {
  const valuePrefixIndex = terminalLine.indexOf(
    TERMINAL_REASON_STRING_VALUE_PREFIX_TEXT,
  );
  if (valuePrefixIndex < 0) {
    return '';
  }
  const [terminalReasonText] = terminalLine
    .slice(valuePrefixIndex + TERMINAL_REASON_STRING_VALUE_PREFIX_TEXT.length)
    .split('"');
  return terminalReasonText.replace(/\r/g, '');
};

const parsedJsonOrNullOf = (line: string): unknown => {
  try {
    const parsedLine: unknown = JSON.parse(line);
    return parsedLine;
  } catch {
    return null;
  }
};

const isAssistantToolCallLine = (line: string): boolean => {
  if (!line.includes(TOOL_USE_TYPE_TEXT)) {
    return false;
  }
  const parsedLine = parsedJsonOrNullOf(line);
  if (!isRecord(parsedLine) || parsedLine.type !== 'assistant') {
    return false;
  }
  const message = parsedLine.message;
  if (!isRecord(message)) {
    return false;
  }
  const content = message.content;
  const contentItems: unknown[] = Array.isArray(content)
    ? content
    : isRecord(content)
      ? Object.values(content)
      : [];
  return contentItems.some(
    (contentItem) => isRecord(contentItem) && contentItem.type === 'tool_use',
  );
};

const workerSessionLogEndingOf = (lines: string[]): WorkerSessionLogEnding => {
  const finalTerminalLine = finalLineContaining(
    lines,
    TERMINAL_REASON_KEY_TEXT,
  );
  return {
    finalTerminalLine,
    terminalReason:
      finalTerminalLine === null ? '' : terminalReasonOf(finalTerminalLine),
    usageLimitEndingFound:
      finalTerminalLine !== null &&
      finalTerminalLine.includes(ERROR_RESULT_FLAG_TEXT) &&
      USAGE_LIMIT_RESULT_TEXT_PATTERN.test(finalTerminalLine),
    rejectedRateLimitEventFound: lines.some(
      (line) =>
        line.includes(RATE_LIMIT_EVENT_TYPE_TEXT) &&
        line.includes(REJECTED_STATUS_TEXT),
    ),
    sessionLimitHttp429Found: lines.some(
      (line) =>
        line.includes(HTTP_429_API_ERROR_STATUS_TEXT) &&
        SESSION_LIMIT_TEXT_PATTERN.test(line),
    ),
    assistantToolCallFound: lines.some(isAssistantToolCallLine),
  };
};

const rateLimitRejectionOf = (
  logEnding: WorkerSessionLogEnding,
  missingAgentNameReported: boolean,
): WorkerSessionRateLimitRejection => {
  if (missingAgentNameReported) {
    return { rateLimitRejected: false, diagnosticLines: [] };
  }
  if (logEnding.usageLimitEndingFound) {
    return {
      rateLimitRejected: true,
      diagnosticLines: [USAGE_LIMIT_ENDING_DETECTED_LINE],
    };
  }
  if (
    logEnding.rejectedRateLimitEventFound &&
    logEnding.terminalReason !== BLOCKING_LIMIT_TERMINAL_REASON &&
    !logEnding.sessionLimitHttp429Found
  ) {
    return {
      rateLimitRejected: true,
      diagnosticLines: [RATE_LIMIT_REJECTION_DETECTED_LINE],
    };
  }
  return { rateLimitRejected: false, diagnosticLines: [] };
};

const errorMessageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failureStreakOutcomeWithoutMoveOf = (
  diagnosticLines: string[],
): WorkerSessionFailureStreakOutcome => ({
  moveToFailedPreparation: false,
  sessionErrorLine: null,
  diagnosticLines,
});

export class WorkerSessionEndClassifyUseCase {
  constructor(
    private readonly workerSessionLogRepository: WorkerSessionLogRepository,
    private readonly workerSessionFailureStreakRepository: WorkerSessionFailureStreakRepository,
  ) {}

  run = async (
    input: WorkerSessionEndClassifyInput,
  ): Promise<WorkerSessionEndClassification> => {
    const logReadResult = await this.workerSessionLogRepository.readLines(
      input.sessionLogFilePath,
    );
    const logReadDiagnosticLines =
      logReadResult.outcome === 'unreadable'
        ? [
            `worker-session-log-unreadable: ${input.sessionLogFilePath}: ${logReadResult.errorMessage}`,
          ]
        : [];
    const logEnding = workerSessionLogEndingOf(
      logReadResult.outcome === 'read' ? logReadResult.lines : [],
    );
    const rateLimitRejection = rateLimitRejectionOf(
      logEnding,
      input.missingAgentNameReported,
    );
    const failureStreakOutcome = await this.failureStreakUpdate(
      input,
      logEnding,
      rateLimitRejection.rateLimitRejected,
    );
    return {
      moveToFailedPreparation: failureStreakOutcome.moveToFailedPreparation,
      rateLimitRejected: rateLimitRejection.rateLimitRejected,
      promptTooLongOnResume:
        input.sessionWasResumed &&
        logEnding.terminalReason === BLOCKING_LIMIT_TERMINAL_REASON &&
        !logEnding.assistantToolCallFound,
      sessionErrorLine: failureStreakOutcome.sessionErrorLine,
      diagnosticLines: [
        ...logReadDiagnosticLines,
        ...rateLimitRejection.diagnosticLines,
        ...failureStreakOutcome.diagnosticLines,
      ],
    };
  };

  private failureStreakUpdate = async (
    input: WorkerSessionEndClassifyInput,
    logEnding: WorkerSessionLogEnding,
    rateLimitRejected: boolean,
  ): Promise<WorkerSessionFailureStreakOutcome> => {
    if (
      logEnding.finalTerminalLine !== null &&
      logEnding.terminalReason === ''
    ) {
      return failureStreakOutcomeWithoutMoveOf([
        `terminal_reason-extraction-failed: line found but value is empty, raw=${logEnding.finalTerminalLine}`,
      ]);
    }
    if (
      logEnding.terminalReason === '' ||
      logEnding.terminalReason === COMPLETED_TERMINAL_REASON
    ) {
      return failureStreakOutcomeWithoutMoveOf(
        await this.failureStreakReset(input.issueUrl),
      );
    }
    if (rateLimitRejected) {
      return failureStreakOutcomeWithoutMoveOf([
        RATE_LIMIT_REJECTION_DETECTED_LINE,
      ]);
    }
    const { storedStreak, diagnosticLines: storedStreakFindDiagnosticLines } =
      await this.failureStreakFind(input.issueUrl);
    const countedStreak: WorkerSessionFailureStreak = {
      terminalReason: logEnding.terminalReason,
      consecutiveFailureCount:
        storedStreak !== null &&
        storedStreak.terminalReason === logEnding.terminalReason
          ? storedStreak.consecutiveFailureCount + 1
          : 1,
    };
    const countedStreakSaveDiagnosticLines = await this.failureStreakSave(
      input.issueUrl,
      countedStreak,
    );
    const countedStreakLines = [
      ...storedStreakFindDiagnosticLines,
      ...countedStreakSaveDiagnosticLines,
      `consecutive-same-reason-failure[${countedStreak.terminalReason}]:${countedStreak.consecutiveFailureCount}/${WORKER_SESSION_CONSECUTIVE_FAILURE_THRESHOLD}`,
    ];
    if (
      countedStreak.consecutiveFailureCount <
        WORKER_SESSION_CONSECUTIVE_FAILURE_THRESHOLD ||
      input.missingAgentNameReported
    ) {
      return failureStreakOutcomeWithoutMoveOf(countedStreakLines);
    }
    return {
      moveToFailedPreparation: true,
      sessionErrorLine: `Task failed ${countedStreak.consecutiveFailureCount} consecutive times with terminal_reason=${countedStreak.terminalReason}; moving to Failed Preparation status. URL=${input.issueUrl}`,
      diagnosticLines: [
        ...countedStreakLines,
        `consecutive-same-reason-failure-max-reached: moving to Failed Preparation, count=${countedStreak.consecutiveFailureCount}, reason=${countedStreak.terminalReason}, url=${input.issueUrl}`,
      ],
    };
  };

  private failureStreakReset = async (issueUrl: string): Promise<string[]> => {
    const { storedStreak, diagnosticLines: storedStreakFindDiagnosticLines } =
      await this.failureStreakFind(issueUrl);
    try {
      await this.workerSessionFailureStreakRepository.deleteByIssueUrl(
        issueUrl,
      );
    } catch (error) {
      return [
        ...storedStreakFindDiagnosticLines,
        `worker-session-failure-streak-undeletable: ${issueUrl}: ${errorMessageOf(error)}`,
      ];
    }
    return storedStreak === null
      ? storedStreakFindDiagnosticLines
      : [...storedStreakFindDiagnosticLines, FAILURE_STREAK_RESET_LINE];
  };

  private failureStreakFind = async (
    issueUrl: string,
  ): Promise<WorkerSessionFailureStreakFindResult> => {
    try {
      return {
        storedStreak:
          await this.workerSessionFailureStreakRepository.findByIssueUrl(
            issueUrl,
          ),
        diagnosticLines: [],
      };
    } catch (error) {
      return {
        storedStreak: null,
        diagnosticLines: [
          `worker-session-failure-streak-unreadable: ${issueUrl}: ${errorMessageOf(error)}`,
        ],
      };
    }
  };

  private failureStreakSave = async (
    issueUrl: string,
    streak: WorkerSessionFailureStreak,
  ): Promise<string[]> => {
    try {
      await this.workerSessionFailureStreakRepository.save(issueUrl, streak);
      return [];
    } catch (error) {
      return [
        `worker-session-failure-streak-unwritable: ${issueUrl}: ${errorMessageOf(error)}`,
      ];
    }
  };
}
