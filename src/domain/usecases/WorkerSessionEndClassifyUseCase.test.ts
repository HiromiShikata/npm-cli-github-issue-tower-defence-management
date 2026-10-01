import { WorkerSessionFailureStreak } from '../entities/WorkerSessionFailureStreak';
import { WorkerSessionFailureStreakRepository } from './adapter-interfaces/WorkerSessionFailureStreakRepository';
import {
  WorkerSessionLogReadResult,
  WorkerSessionLogRepository,
} from './adapter-interfaces/WorkerSessionLogRepository';
import {
  WORKER_SESSION_CONSECUTIVE_FAILURE_THRESHOLD,
  WorkerSessionEndClassification,
  WorkerSessionEndClassifyInput,
  WorkerSessionEndClassifyUseCase,
} from './WorkerSessionEndClassifyUseCase';

const issueUrl = 'https://github.com/owner/repo/issues/999';
const otherIssueUrl = 'https://github.com/owner/repo/issues/1000';
const sessionLogFilePath = '/logs/aw/worker-session-999.log';
const missingSessionLogFilePath = '/logs/aw/worker-session-missing.log';

const sessionLimitEndingLine =
  '{"type":"result","subtype":"success","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve hit your session limit · resets 6:50am (UTC)"}';
const weeklyLimitEndingLine =
  '{"type":"result","subtype":"success","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve hit your weekly limit · resets Sep 21, 10pm (UTC)"}';
const sessionLimitDuringFailedCompactionEndingLine =
  '{"type":"result","is_error":true,"terminal_reason":"blocking_limit","result":"Prompt is too long · automatic compaction failed: You\'ve hit your session limit · resets 1:30am (UTC)"}';
const truncatedSessionLimitEndingTextLine =
  '{"type":"result","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve hit your session limit · resets';
const capitalizedHitYourSessionLimitEndingLine =
  '{"type":"result","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve Hit Your session limit · resets 6:50am (UTC)"}';
const notErrorSessionLimitEndingLine =
  '{"type":"result","is_error":false,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve hit your session limit · resets 6:50am (UTC)"}';
const hyphenatedLimitNameEndingLine =
  '{"type":"result","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"You\'ve hit your 5-hour limit · resets 6:50am (UTC)"}';

const overloadedEndingLine =
  '{"type":"result","is_error":true,"result":"API Error: Overloaded","api_error_status":529,"terminal_reason":"api_error"}';
const overloadedEndingWithStatusFirstLine =
  '{"type":"result","is_error":true,"api_error_status":529,"terminal_reason":"api_error","result":"API Error: Overloaded"}';
const serverErrorEndingLine =
  '{"type":"result","is_error":true,"result":"API Error: 500 Internal server error","api_error_status":500,"terminal_reason":"api_error"}';
const oneMillionContextEndingLine =
  '{"type":"result","is_error":true,"result":"API Error: one million extended context window","api_error_status":429,"terminal_reason":"api_error"}';
const usageCreditsRequiredEndingLine =
  '{"type":"result","is_error":true,"result":"API Error: Usage credits required for 1M context","api_error_status":429,"terminal_reason":"api_error"}';
const sessionLimitWithoutHitYourEndingLine =
  '{"type":"result","is_error":true,"api_error_status":429,"terminal_reason":"api_error","result":"API Error: 429 Session Limit reached for this organization"}';
const promptTooLongEndingLine =
  '{"type":"result","is_error":true,"terminal_reason":"blocking_limit","result":"Prompt is too long"}';
const blockingLimitWithOtherResultEndingLine =
  '{"type":"result","is_error":true,"terminal_reason":"blocking_limit","result":"Request too large for the context window"}';
const completedEndingLine =
  '{"type":"result","subtype":"success","is_error":false,"terminal_reason":"completed","result":"Posted the completion report on the task issue"}';
const completedEndingQuotingSessionLimitLine =
  '{"type":"result","subtype":"success","is_error":false,"terminal_reason":"completed","result":"Explained why sessions end with You\'ve hit your session limit · resets 5:40am (UTC)"}';
const completedErrorEndingWithSessionLimitLine =
  '{"type":"result","is_error":true,"terminal_reason":"completed","result":"You\'ve hit your session limit · resets 6:50am (UTC)"}';

const truncatedApiErrorTerminalTextLine =
  '{"type":"result","is_error":true,"terminal_reason":"api_error"';
const standardErrorWrappedApiErrorTerminalTextLine =
  '[stderr] Error: {"type":"result","is_error":true,"terminal_reason":"api_error"}';
const carriageReturnInReasonTerminalLine =
  '{"type":"result","is_error":true,"terminal_reason":"api_error\r"}';
const twoTerminalReasonsOnOneLine =
  '{"type":"result","is_error":true,"terminal_reason":"blocking_limit","previous":{"terminal_reason":"completed"}}';

const emptyStringReasonTerminalLine = '{"type":"result","terminal_reason":""}';
const nullReasonTerminalLine =
  '{"type":"result","is_error":true,"result":"API Error: Overloaded","terminal_reason":null}';
const numericReasonTerminalLine =
  '{"type":"result","is_error":true,"result":"API Error: Overloaded","terminal_reason":42}';
const spacedReasonTerminalLine =
  '{"type": "result", "is_error": true, "terminal_reason": "api_error"}';
const jsonArrayMentioningTerminalReasonLine = '["terminal_reason","api_error"]';

const rejectedRateLimitEventLine =
  '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"five_hour"}}';
const launcherRejectedRateLimitEventLine =
  '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":1790314800,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false}}';
const standardErrorWrappedRejectedRateLimitEventLine =
  '[stderr] stream event {"type":"rate_limit_event","rate_limit_info":{"status":"rejected"';
const allowedRateLimitEventLine =
  '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour"}}';
const allowedWarningRateLimitEventLine =
  '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed_warning","resetsAt":1788341400,"rateLimitType":"five_hour","utilization":0.99,"isUsingOverage":false,"surpassedThreshold":0.9}}';
const allowedRateLimitEventWithRejectedOverageLine =
  '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1790314800,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false}}';
const rejectedStatusWithoutRateLimitEventLine =
  '{"type":"user","message":{"content":[{"type":"tool_result","status":"rejected"}]}}';

const http429WithoutSessionLimitLine =
  '{"type":"system","subtype":"api_retry","api_error_status":429,"error":"rate_limit"}';
const sessionLimitWithoutHttp429Line =
  'Launcher note: the previous session hit the session limit';
const standardErrorUpperCaseSessionLimitLine =
  'API Error: 429 {"api_error_status":429,"error":"SESSION LIMIT exceeded"}';

const assistantToolUseLine =
  '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t1","name":"Bash","input":{}}]}}';
const assistantTextLine =
  '{"type":"assistant","message":{"content":[{"type":"text","text":"Reading the task issue"}]}}';
const launcherSessionResumptionTextLine =
  'Session resumption: resuming the previous conversation of this task';
const launcherStreakResetTextLine =
  'consecutive-same-reason-failure: reset (run succeeded or no terminal_reason)';

const launcherPromptTooLongResumptionLine =
  'Session resumption: resuming ses-ptl-0001 for https://github.com/owner/repo/issues/1/impl';
const launcherPromptTooLongTextMentionsToolUseLine =
  'Request: explain what "type":"tool_use" means in a stream-json log';
const launcherPromptTooLongSystemInitLine =
  '{"type":"system","subtype":"init","session_id":"ses-ptl-0001"}';
const launcherPromptTooLongToolCallLine =
  '{"type":"assistant","message":{"content":[{"type":"tool_use","id":"toolu_01","name":"Bash","input":{"command":"true"}}]},"session_id":"ses-ptl-0001"}';
const launcherPromptTooLongResultLine = (terminalReason: string): string =>
  `{"type":"result","is_error":true,"result":"Prompt is too long","terminal_reason":"${terminalReason}","session_id":"ses-ptl-0001"}`;
const blockingLimitContextWindowExceededEndingLine =
  '{"type":"result","is_error":true,"result":"Context window exceeded","terminal_reason":"blocking_limit"}';
const userMessageHoldingToolUseItemLine =
  '{"type":"user","message":{"content":[{"type":"tool_use","id":"t2","name":"Bash","input":{}}]}}';
const assistantTextItemWithNestedToolUseTypeLine =
  '{"type":"assistant","message":{"content":[{"type":"text","text":"Planning","input":{"type":"tool_use"}}]}}';
const jsonArrayHoldingToolUseItemLine =
  '[{"type":"assistant","message":{"content":[{"type":"tool_use","id":"t3"}]}}]';
const spacedAssistantToolUseLine =
  '{"type": "assistant", "message": {"content": [{"type": "tool_use", "id": "t4", "name": "Bash", "input": {}}]}}';
const assistantTextAndToolUseLine =
  '{"type":"assistant","message":{"content":[{"type":"text","text":"Running the tests"},{"type":"tool_use","id":"t5","name":"Bash","input":{}}]}}';
const standardErrorWrappedAssistantToolUseLine =
  '[stderr] {"type":"assistant","message":{"content":[{"type":"tool_use","id":"t6","name":"Bash","input":{}}]}}';
const assistantObjectContentHoldingToolUseLine =
  '{"type":"assistant","message":{"content":{"first":{"type":"tool_use","name":"Bash"}}}}';
const assistantStringContentQuotingToolUseLine =
  '{"type":"assistant","message":{"content":"plain text mentioning \\"type\\":\\"tool_use\\""}}';
const assistantStringContentBesideToolUseTypeLine =
  '{"type":"assistant","message":{"content":"plain text"},"note":{"type":"tool_use"}}';

const launcherThreeSessionLimitEndingLines = [
  '{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","resetsAt":1790318400,"rateLimitType":"five_hour","overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,"unifiedWindows":{"five_hour":{"utilization":1,"resetsAt":1790318400},"seven_day":{"utilization":0.6,"resetsAt":1790632800}}}}',
  '{"type":"assistant","message":{"model":"<synthetic>","role":"assistant","stop_reason":"stop_sequence","content":[{"type":"text","text":"You\'ve hit your session limit · resets 6:40am (UTC)"}]},"error":"rate_limit"}',
  '{"duration_api_ms":2987048,"stop_reason":"stop_sequence","session_id":"785fbe16-057e-4eeb-bcba-8b89169e67aa","total_cost_usd":13.8,"permission_denials":[],"terminal_reason":"api_error","is_error":true,"num_turns":295,"subtype":"success","api_error_status":429,"result":"You\'ve hit your session limit · resets 6:40am (UTC)","type":"result","duration_ms":3331613,"queued_turn_count":0,"result_index":0}',
];
const launcherGenuineApiErrorEndingLine =
  '{"duration_api_ms":2987048,"stop_reason":"stop_sequence","session_id":"785fbe16-057e-4eeb-bcba-8b89169e67aa","total_cost_usd":13.8,"permission_denials":[],"terminal_reason":"api_error","is_error":true,"num_turns":295,"subtype":"success","api_error_status":500,"result":"API Error: 500 {\\"type\\":\\"error\\",\\"error\\":{\\"type\\":\\"api_error\\",\\"message\\":\\"Internal server error\\"}}","type":"result","duration_ms":3331613,"queued_turn_count":0,"result_index":0}';
const launcherSessionLimitApiErrorEndingLine =
  '{"type":"result","is_error":true,"result":"You\'ve hit your session limit · resets 1:40pm (UTC)","api_error_status":429,"terminal_reason":"api_error"}';
const launcherWeeklyLimitApiErrorEndingLine =
  '{"type":"result","is_error":true,"result":"You\'ve hit your weekly limit · resets Sep 26, 3pm (UTC)","api_error_status":429,"terminal_reason":"api_error"}';
const launcherSessionLimitDuringFailedCompactionEndingLine =
  '{"type":"result","is_error":true,"result":"Prompt is too long · automatic compaction failed: You\'ve hit your session limit · resets 5:40am (UTC)","terminal_reason":"blocking_limit"}';
const launcherWeeklyLimitDuringFailedCompactionEndingLine =
  '{"type":"result","is_error":true,"result":"Prompt is too long · automatic compaction failed: You\'ve hit your weekly limit · resets 3pm (UTC)","terminal_reason":"blocking_limit"}';
const launcherServerErrorEndingLine =
  '{"type":"result","is_error":true,"result":"API Error: 500 Internal server error","api_error_status":500,"terminal_reason":"api_error"}';
const launcherCompletedEndingQuotingLimitLine =
  '{"type":"result","is_error":false,"result":"Explained why sessions end with You\'ve hit your session limit · resets 5:40am (UTC)","terminal_reason":"completed"}';

const usageLimitEndingDetectedLine =
  'usage-limit-ending-detected: consecutive failure counter not incremented';
const rateLimitRejectionDetectedLine =
  'rate-limit-rejection-detected: consecutive failure counter not incremented';
const streakResetLine =
  'consecutive-same-reason-failure: reset (run succeeded or no terminal_reason)';

const consecutiveSameReasonFailureLine = (
  terminalReason: string,
  consecutiveFailureCount: number,
): string =>
  `consecutive-same-reason-failure[${terminalReason}]:${consecutiveFailureCount}/3`;

const consecutiveSameReasonFailureMaxReachedLine = (
  terminalReason: string,
  consecutiveFailureCount: number,
): string =>
  `consecutive-same-reason-failure-max-reached: moving to Failed Preparation, count=${consecutiveFailureCount}, reason=${terminalReason}, url=${issueUrl}`;

const failedPreparationSessionErrorLine = (
  terminalReason: string,
  consecutiveFailureCount: number,
): string =>
  `Task failed ${consecutiveFailureCount} consecutive times with terminal_reason=${terminalReason}; moving to Failed Preparation status. URL=${issueUrl}`;

const terminalReasonExtractionFailedLine = (terminalLine: string): string =>
  `terminal_reason-extraction-failed: line found but value is empty, raw=${terminalLine}`;

const unreadableErrorMessage = (requestedSessionLogFilePath: string): string =>
  `ENOENT: no such file or directory, open '${requestedSessionLogFilePath}'`;

class InMemoryWorkerSessionLogRepository implements WorkerSessionLogRepository {
  constructor(
    private readonly linesBySessionLogFilePath: Map<string, string[]>,
  ) {}

  readLines = async (
    requestedSessionLogFilePath: string,
  ): Promise<WorkerSessionLogReadResult> => {
    const lines = this.linesBySessionLogFilePath.get(
      requestedSessionLogFilePath,
    );
    if (lines === undefined) {
      return {
        outcome: 'unreadable',
        errorMessage: unreadableErrorMessage(requestedSessionLogFilePath),
      };
    }
    return { outcome: 'read', lines: [...lines] };
  };
}

class InMemoryWorkerSessionFailureStreakRepository implements WorkerSessionFailureStreakRepository {
  private readonly streakByIssueUrl = new Map<
    string,
    WorkerSessionFailureStreak
  >();

  findByIssueUrl = async (
    requestedIssueUrl: string,
  ): Promise<WorkerSessionFailureStreak | null> => {
    const storedStreak = this.streakByIssueUrl.get(requestedIssueUrl);
    return storedStreak === undefined ? null : { ...storedStreak };
  };

  save = async (
    requestedIssueUrl: string,
    streak: WorkerSessionFailureStreak,
  ): Promise<void> => {
    this.streakByIssueUrl.set(requestedIssueUrl, { ...streak });
  };

  deleteByIssueUrl = async (requestedIssueUrl: string): Promise<void> => {
    this.streakByIssueUrl.delete(requestedIssueUrl);
  };

  storedStreakOf = (
    requestedIssueUrl: string,
  ): WorkerSessionFailureStreak | null => {
    const storedStreak = this.streakByIssueUrl.get(requestedIssueUrl);
    return storedStreak === undefined ? null : { ...storedStreak };
  };
}

type WorkerSessionEndClassifyScenario = {
  logLines: string[];
  storedStreak: WorkerSessionFailureStreak | null;
  sessionWasResumed: boolean;
  missingAgentNameReported: boolean;
};

const classifyWorkerSessionEnd = async (
  scenario: WorkerSessionEndClassifyScenario,
): Promise<{
  classification: WorkerSessionEndClassification;
  streakAfterClassification: WorkerSessionFailureStreak | null;
}> => {
  const workerSessionFailureStreakRepository =
    new InMemoryWorkerSessionFailureStreakRepository();
  if (scenario.storedStreak !== null) {
    await workerSessionFailureStreakRepository.save(
      issueUrl,
      scenario.storedStreak,
    );
  }
  const useCase = new WorkerSessionEndClassifyUseCase(
    new InMemoryWorkerSessionLogRepository(
      new Map([[sessionLogFilePath, scenario.logLines]]),
    ),
    workerSessionFailureStreakRepository,
  );
  const classification = await useCase.run({
    issueUrl,
    sessionLogFilePath,
    sessionWasResumed: scenario.sessionWasResumed,
    missingAgentNameReported: scenario.missingAgentNameReported,
  });
  return {
    classification,
    streakAfterClassification:
      workerSessionFailureStreakRepository.storedStreakOf(issueUrl),
  };
};

const runUseCaseForConsecutiveSessions = async (
  useCase: WorkerSessionEndClassifyUseCase,
  input: WorkerSessionEndClassifyInput,
  sessionCount: number,
): Promise<WorkerSessionEndClassification[]> => {
  const classifications: WorkerSessionEndClassification[] = [];
  for (
    let sessionNumber = 1;
    sessionNumber <= sessionCount;
    sessionNumber += 1
  ) {
    classifications.push(await useCase.run(input));
  }
  return classifications;
};

describe('WorkerSessionEndClassifyUseCase', () => {
  it('declares three consecutive same-reason failures as the threshold for Failed Preparation', () => {
    expect(WORKER_SESSION_CONSECUTIVE_FAILURE_THRESHOLD).toBe(3);
  });

  describe('usage-limit endings', () => {
    it.each([
      {
        label: 'a session limit ending with terminal_reason api_error',
        logLines: [launcherSessionResumptionTextLine, sessionLimitEndingLine],
      },
      {
        label: 'a weekly limit ending with terminal_reason api_error',
        logLines: [weeklyLimitEndingLine],
      },
      {
        label:
          'a session limit hit during failed compaction ending with terminal_reason blocking_limit',
        logLines: [sessionLimitDuringFailedCompactionEndingLine],
      },
      {
        label:
          'a session limit hit during failed compaction after a rejected rate-limit event',
        logLines: [
          rejectedRateLimitEventLine,
          sessionLimitDuringFailedCompactionEndingLine,
        ],
      },
      {
        label: 'a final terminal line that is truncated text and not JSON',
        logLines: [truncatedSessionLimitEndingTextLine],
      },
    ])(
      'marks $label as rate-limited without counting it toward Failed Preparation',
      async ({ logLines }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak: {
              terminalReason: 'api_error',
              consecutiveFailureCount: 2,
            },
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.rateLimitRejected).toBe(true);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(streakAfterClassification).toEqual({
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        });
        const usageLimitLineIndex = classification.diagnosticLines.indexOf(
          usageLimitEndingDetectedLine,
        );
        expect(usageLimitLineIndex).toBeGreaterThanOrEqual(0);
        expect(
          classification.diagnosticLines.slice(usageLimitLineIndex + 1),
        ).toContain(rateLimitRejectionDetectedLine);
      },
    );

    it.each([
      {
        label: 'a result text spelled You have Hit Your session limit',
        finalTerminalLine: capitalizedHitYourSessionLimitEndingLine,
      },
      {
        label: 'a final terminal line holding "is_error":false',
        finalTerminalLine: notErrorSessionLimitEndingLine,
      },
      {
        label:
          'a limit name holding a character outside letters, digits and spaces',
        finalTerminalLine: hyphenatedLimitNameEndingLine,
      },
    ])(
      'counts $label as an ordinary api_error failure instead of a usage-limit ending',
      async ({ finalTerminalLine }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines: [finalTerminalLine],
            storedStreak: null,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.diagnosticLines).not.toContain(
          usageLimitEndingDetectedLine,
        );
        expect(streakAfterClassification).toEqual({
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        });
        expect(classification.diagnosticLines).toContain(
          consecutiveSameReasonFailureLine('api_error', 1),
        );
      },
    );

    it('does not treat a session limit text on an earlier terminal line as a usage-limit ending', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [sessionLimitEndingLine, serverErrorEndingLine],
          storedStreak: null,
          sessionWasResumed: false,
          missingAgentNameReported: false,
        });

      expect(classification.rateLimitRejected).toBe(false);
      expect(classification.diagnosticLines).not.toContain(
        usageLimitEndingDetectedLine,
      );
      expect(streakAfterClassification).toEqual({
        terminalReason: 'api_error',
        consecutiveFailureCount: 1,
      });
    });

    it.each([
      {
        label: 'session limit api_error',
        logLines: [
          launcherRejectedRateLimitEventLine,
          launcherSessionLimitApiErrorEndingLine,
        ],
        expectedRateLimitRejected: true,
        expectedMoveToFailedPreparation: false,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'weekly limit api_error',
        logLines: [
          launcherRejectedRateLimitEventLine,
          launcherWeeklyLimitApiErrorEndingLine,
        ],
        expectedRateLimitRejected: true,
        expectedMoveToFailedPreparation: false,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'session limit during failed compaction',
        logLines: [
          launcherRejectedRateLimitEventLine,
          launcherSessionLimitDuringFailedCompactionEndingLine,
        ],
        expectedRateLimitRejected: true,
        expectedMoveToFailedPreparation: false,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'weekly limit during failed compaction',
        logLines: [
          launcherRejectedRateLimitEventLine,
          launcherWeeklyLimitDuringFailedCompactionEndingLine,
        ],
        expectedRateLimitRejected: true,
        expectedMoveToFailedPreparation: false,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'server error api_error',
        logLines: [launcherServerErrorEndingLine],
        expectedRateLimitRejected: false,
        expectedMoveToFailedPreparation: true,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 3,
        },
      },
      {
        label: 'completed result quoting the limit text',
        logLines: [launcherCompletedEndingQuotingLimitLine],
        expectedRateLimitRejected: false,
        expectedMoveToFailedPreparation: false,
        expectedStreak: null,
      },
    ])(
      'decides the launcher usage-limit case $label after a stored api_error streak of 2',
      async ({
        logLines,
        expectedRateLimitRejected,
        expectedMoveToFailedPreparation,
        expectedStreak,
      }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak: {
              terminalReason: 'api_error',
              consecutiveFailureCount: 2,
            },
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.rateLimitRejected).toBe(
          expectedRateLimitRejected,
        );
        expect(classification.moveToFailedPreparation).toBe(
          expectedMoveToFailedPreparation,
        );
        expect(streakAfterClassification).toEqual(expectedStreak);
      },
    );
  });

  describe('rejected rate-limit events', () => {
    it.each([
      {
        label: 'the rejected rate-limit event line of the specification',
        logLines: [
          allowedRateLimitEventLine,
          rejectedRateLimitEventLine,
          assistantTextLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
      {
        label: 'the rejected rate-limit event line the launcher records',
        logLines: [
          launcherRejectedRateLimitEventLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
      {
        label:
          'a non-JSON standard error line holding both rejected rate-limit texts',
        logLines: [
          standardErrorWrappedRejectedRateLimitEventLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
      {
        label:
          'a 429 line and a session limit line that are two different lines',
        logLines: [
          rejectedRateLimitEventLine,
          http429WithoutSessionLimitLine,
          sessionLimitWithoutHttp429Line,
          overloadedEndingWithStatusFirstLine,
        ],
      },
    ])(
      'marks a session ending on API Error: Overloaded as rate-limited without counting it for $label',
      async ({ logLines }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak: {
              terminalReason: 'api_error',
              consecutiveFailureCount: 2,
            },
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.rateLimitRejected).toBe(true);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(streakAfterClassification).toEqual({
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        });
        expect(classification.diagnosticLines).toContain(
          rateLimitRejectionDetectedLine,
        );
        expect(classification.diagnosticLines).not.toContain(
          consecutiveSameReasonFailureLine('api_error', 3),
        );
      },
    );

    it.each([
      {
        label:
          'the rate-limit event is allowed and "status":"rejected" sits on another line',
        logLines: [
          allowedRateLimitEventLine,
          rejectedStatusWithoutRateLimitEventLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
      {
        label:
          'the rate-limit event is allowed and only its overageStatus is rejected',
        logLines: [
          allowedRateLimitEventWithRejectedOverageLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
      {
        label: 'the only rate-limit event is allowed_warning',
        logLines: [
          allowedWarningRateLimitEventLine,
          overloadedEndingWithStatusFirstLine,
        ],
      },
    ])('counts the session when $label', async ({ logLines }) => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines,
          storedStreak: {
            terminalReason: 'api_error',
            consecutiveFailureCount: 1,
          },
          sessionWasResumed: false,
          missingAgentNameReported: false,
        });

      expect(classification.rateLimitRejected).toBe(false);
      expect(classification.diagnosticLines).not.toContain(
        rateLimitRejectionDetectedLine,
      );
      expect(streakAfterClassification).toEqual({
        terminalReason: 'api_error',
        consecutiveFailureCount: 2,
      });
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureLine('api_error', 2),
      );
    });

    it.each([
      {
        label:
          'the final terminal line is blocking_limit with result Prompt is too long',
        logLines: [rejectedRateLimitEventLine, promptTooLongEndingLine],
        expectedTerminalReason: 'blocking_limit',
      },
      {
        label:
          'the final terminal line is blocking_limit with a result text other than Prompt is too long',
        logLines: [
          rejectedRateLimitEventLine,
          blockingLimitWithOtherResultEndingLine,
        ],
        expectedTerminalReason: 'blocking_limit',
      },
      {
        label: 'a 429 session limit line exists before the final terminal line',
        logLines: [
          rejectedRateLimitEventLine,
          sessionLimitEndingLine,
          launcherSessionResumptionTextLine,
          overloadedEndingLine,
        ],
        expectedTerminalReason: 'api_error',
      },
      {
        label:
          'the final terminal line itself holds "api_error_status":429 and Session Limit without a hit your limit text',
        logLines: [
          rejectedRateLimitEventLine,
          sessionLimitWithoutHitYourEndingLine,
        ],
        expectedTerminalReason: 'api_error',
      },
      {
        label:
          'a non-JSON standard error line holds "api_error_status":429 and SESSION LIMIT',
        logLines: [
          rejectedRateLimitEventLine,
          standardErrorUpperCaseSessionLimitLine,
          overloadedEndingLine,
        ],
        expectedTerminalReason: 'api_error',
      },
    ])(
      'does not mark the session as rate-limited and counts it when $label',
      async ({ logLines, expectedTerminalReason }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak: null,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(streakAfterClassification).toEqual({
          terminalReason: expectedTerminalReason,
          consecutiveFailureCount: 1,
        });
        expect(classification.diagnosticLines).toContain(
          consecutiveSameReasonFailureLine(expectedTerminalReason, 1),
        );
        expect(classification.diagnosticLines).not.toContain(
          rateLimitRejectionDetectedLine,
        );
      },
    );
  });

  describe('counting consecutive same-reason failures', () => {
    it.each([
      {
        label: 'a first api_error failure with no stored streak',
        logLines: [serverErrorEndingLine],
        storedStreak: null,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
      },
      {
        label: 'a second api_error failure after one stored api_error failure',
        logLines: [assistantToolUseLine, serverErrorEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'an api_error failure after a stored blocking_limit streak',
        logLines: [overloadedEndingLine],
        storedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 2,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
      },
      {
        label: 'a blocking_limit failure after a stored api_error streak',
        logLines: [promptTooLongEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 1,
        },
      },
      {
        label:
          'a final blocking_limit line after an earlier api_error terminal line',
        logLines: [overloadedEndingLine, promptTooLongEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 1,
        },
      },
      {
        label:
          'an api_error failure after allowed and allowed_warning rate-limit events',
        logLines: [
          allowedRateLimitEventLine,
          allowedWarningRateLimitEventLine,
          overloadedEndingLine,
        ],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'a truncated final terminal line that is not JSON',
        logLines: [overloadedEndingLine, truncatedApiErrorTerminalTextLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label:
          'a standard error line wrapping a terminal record as the final terminal line',
        logLines: [
          promptTooLongEndingLine,
          standardErrorWrappedApiErrorTerminalTextLine,
        ],
        storedStreak: null,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
      },
      {
        label: 'a final terminal reason followed by a carriage return',
        logLines: [carriageReturnInReasonTerminalLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'a final terminal line holding two terminal_reason texts',
        logLines: [twoTerminalReasonsOnOneLine],
        storedStreak: null,
        expectedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 1,
        },
      },
      {
        label:
          'a launcher reset line mentioning terminal_reason without quotes after the final terminal line',
        logLines: [overloadedEndingLine, launcherStreakResetTextLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
    ])(
      'saves the counted streak for $label',
      async ({ logLines, storedStreak, expectedStreak }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(streakAfterClassification).toEqual(expectedStreak);
        expect(classification.diagnosticLines).toContain(
          consecutiveSameReasonFailureLine(
            expectedStreak.terminalReason,
            expectedStreak.consecutiveFailureCount,
          ),
        );
        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
      },
    );
  });

  describe('moving to Failed Preparation', () => {
    it('moves the session to Failed Preparation on the third consecutive API Error: Overloaded ending', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [overloadedEndingLine],
          storedStreak: {
            terminalReason: 'api_error',
            consecutiveFailureCount: 2,
          },
          sessionWasResumed: false,
          missingAgentNameReported: false,
        });

      expect(classification.moveToFailedPreparation).toBe(true);
      expect(classification.rateLimitRejected).toBe(false);
      expect(classification.sessionErrorLine).toBe(
        failedPreparationSessionErrorLine('api_error', 3),
      );
      expect(streakAfterClassification).toEqual({
        terminalReason: 'api_error',
        consecutiveFailureCount: 3,
      });
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureLine('api_error', 3),
      );
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureMaxReachedLine('api_error', 3),
      );
    });

    it.each([
      {
        label: 'API Error: one million extended context window',
        finalTerminalLine: oneMillionContextEndingLine,
      },
      {
        label: 'API Error: Usage credits required for 1M context',
        finalTerminalLine: usageCreditsRequiredEndingLine,
      },
    ])(
      'moves a third consecutive 429 ending with $label to Failed Preparation',
      async ({ finalTerminalLine }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines: [finalTerminalLine],
            storedStreak: {
              terminalReason: 'api_error',
              consecutiveFailureCount: 2,
            },
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.moveToFailedPreparation).toBe(true);
        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.sessionErrorLine).toBe(
          failedPreparationSessionErrorLine('api_error', 3),
        );
        expect(streakAfterClassification).toEqual({
          terminalReason: 'api_error',
          consecutiveFailureCount: 3,
        });
      },
    );

    it('moves the session to Failed Preparation when the count goes above three', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [overloadedEndingLine],
          storedStreak: {
            terminalReason: 'api_error',
            consecutiveFailureCount: 3,
          },
          sessionWasResumed: false,
          missingAgentNameReported: false,
        });

      expect(classification.moveToFailedPreparation).toBe(true);
      expect(classification.sessionErrorLine).toBe(
        failedPreparationSessionErrorLine('api_error', 4),
      );
      expect(streakAfterClassification).toEqual({
        terminalReason: 'api_error',
        consecutiveFailureCount: 4,
      });
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureLine('api_error', 4),
      );
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureMaxReachedLine('api_error', 4),
      );
    });
  });

  describe('consecutive classifications of one issue', () => {
    it.each([
      {
        label: 'the API Error: Overloaded ending of the specification',
        logLines: [overloadedEndingLine],
      },
      {
        label: 'the genuine api_error ending the launcher records',
        logLines: [launcherGenuineApiErrorEndingLine],
      },
    ])(
      'moves to Failed Preparation only on the third consecutive classification of $label',
      async ({ logLines }) => {
        const workerSessionFailureStreakRepository =
          new InMemoryWorkerSessionFailureStreakRepository();
        const useCase = new WorkerSessionEndClassifyUseCase(
          new InMemoryWorkerSessionLogRepository(
            new Map([[sessionLogFilePath, logLines]]),
          ),
          workerSessionFailureStreakRepository,
        );

        const classifications = await runUseCaseForConsecutiveSessions(
          useCase,
          {
            issueUrl,
            sessionLogFilePath,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          },
          3,
        );

        expect(
          classifications.map(
            (classification) => classification.moveToFailedPreparation,
          ),
        ).toEqual([false, false, true]);
        expect(
          classifications.map(
            (classification) => classification.rateLimitRejected,
          ),
        ).toEqual([false, false, false]);
        expect(
          workerSessionFailureStreakRepository.storedStreakOf(issueUrl),
        ).toEqual({
          terminalReason: 'api_error',
          consecutiveFailureCount: 3,
        });
      },
    );

    it.each([
      {
        label: 'the session limit ending of the specification',
        logLines: [sessionLimitEndingLine],
      },
      {
        label: 'the session limit ending the launcher records',
        logLines: launcherThreeSessionLimitEndingLines,
      },
    ])(
      'marks every one of three consecutive classifications of $label as rate-limited and stores no streak',
      async ({ logLines }) => {
        const workerSessionFailureStreakRepository =
          new InMemoryWorkerSessionFailureStreakRepository();
        const useCase = new WorkerSessionEndClassifyUseCase(
          new InMemoryWorkerSessionLogRepository(
            new Map([[sessionLogFilePath, logLines]]),
          ),
          workerSessionFailureStreakRepository,
        );

        const classifications = await runUseCaseForConsecutiveSessions(
          useCase,
          {
            issueUrl,
            sessionLogFilePath,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          },
          3,
        );

        expect(
          classifications.map(
            (classification) => classification.rateLimitRejected,
          ),
        ).toEqual([true, true, true]);
        expect(
          classifications.map(
            (classification) => classification.moveToFailedPreparation,
          ),
        ).toEqual([false, false, false]);
        expect(
          workerSessionFailureStreakRepository.storedStreakOf(issueUrl),
        ).toBeNull();
      },
    );

    it('keeps the streaks of two issues independent', async () => {
      const workerSessionFailureStreakRepository =
        new InMemoryWorkerSessionFailureStreakRepository();
      await workerSessionFailureStreakRepository.save(otherIssueUrl, {
        terminalReason: 'api_error',
        consecutiveFailureCount: 2,
      });
      const useCase = new WorkerSessionEndClassifyUseCase(
        new InMemoryWorkerSessionLogRepository(
          new Map([[sessionLogFilePath, [overloadedEndingLine]]]),
        ),
        workerSessionFailureStreakRepository,
      );

      const classification = await useCase.run({
        issueUrl,
        sessionLogFilePath,
        sessionWasResumed: false,
        missingAgentNameReported: false,
      });

      expect(classification.moveToFailedPreparation).toBe(false);
      expect(
        workerSessionFailureStreakRepository.storedStreakOf(issueUrl),
      ).toEqual({
        terminalReason: 'api_error',
        consecutiveFailureCount: 1,
      });
      expect(
        workerSessionFailureStreakRepository.storedStreakOf(otherIssueUrl),
      ).toEqual({ terminalReason: 'api_error', consecutiveFailureCount: 2 });
    });
  });

  describe('resetting the streak', () => {
    it.each([
      {
        label: 'a completed ending with a stored streak',
        logLines: [assistantToolUseLine, completedEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label:
          'a completed ending holding "is_error":false whose result quotes the session limit text',
        logLines: [completedEndingQuotingSessionLimitLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label: 'a completed ending after an earlier api_error terminal line',
        logLines: [overloadedEndingLine, completedEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label: 'a completed ending after a rejected rate-limit event',
        logLines: [rejectedRateLimitEventLine, completedEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: true,
        expectResetLine: true,
      },
      {
        label:
          'a completed ending holding "is_error":true whose result is a session limit text',
        logLines: [completedErrorEndingWithSessionLimitLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: true,
        expectResetLine: true,
      },
      {
        label: 'a log without any line holding "terminal_reason"',
        logLines: [launcherSessionResumptionTextLine, assistantTextLine],
        storedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 1,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label:
          'a log whose only rejected rate-limit event line is the launcher one and no terminal line',
        logLines: [launcherRejectedRateLimitEventLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: true,
        expectResetLine: true,
      },
      {
        label:
          'a log whose only allowed_warning rate-limit event has no terminal line',
        logLines: [allowedWarningRateLimitEventLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label:
          'a log whose only terminal_reason mention is a launcher line without quotes',
        logLines: [launcherStreakResetTextLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label: 'an empty log with a stored streak',
        logLines: [],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedRateLimitRejected: false,
        expectResetLine: true,
      },
      {
        label: 'a completed ending without a stored streak',
        logLines: [completedEndingLine],
        storedStreak: null,
        expectedRateLimitRejected: false,
        expectResetLine: false,
      },
      {
        label: 'a log without any terminal line and no stored streak',
        logLines: [assistantTextLine],
        storedStreak: null,
        expectedRateLimitRejected: false,
        expectResetLine: false,
      },
    ])(
      'deletes the streak without moving to Failed Preparation for $label',
      async ({
        logLines,
        storedStreak,
        expectedRateLimitRejected,
        expectResetLine,
      }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.rateLimitRejected).toBe(
          expectedRateLimitRejected,
        );
        expect(classification.promptTooLongOnResume).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(streakAfterClassification).toBeNull();
        expect(classification.diagnosticLines.includes(streakResetLine)).toBe(
          expectResetLine,
        );
      },
    );
  });

  describe('unextractable terminal_reason', () => {
    it.each([
      {
        label: 'an empty string',
        logLines: [emptyStringReasonTerminalLine],
        finalTerminalLine: emptyStringReasonTerminalLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'null',
        logLines: [nullReasonTerminalLine],
        finalTerminalLine: nullReasonTerminalLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'a number',
        logLines: [numericReasonTerminalLine],
        finalTerminalLine: numericReasonTerminalLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'a string written with a space after the colon',
        logLines: [spacedReasonTerminalLine],
        finalTerminalLine: spacedReasonTerminalLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'a JSON array element instead of an object key',
        logLines: [overloadedEndingLine, jsonArrayMentioningTerminalReasonLine],
        finalTerminalLine: jsonArrayMentioningTerminalReasonLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'an empty string after an earlier api_error terminal line',
        logLines: [overloadedEndingLine, emptyStringReasonTerminalLine],
        finalTerminalLine: emptyStringReasonTerminalLine,
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
      },
      {
        label: 'an empty string with no stored streak',
        logLines: [emptyStringReasonTerminalLine],
        finalTerminalLine: emptyStringReasonTerminalLine,
        storedStreak: null,
      },
    ])(
      'leaves the stored streak unchanged when the final terminal_reason is $label',
      async ({ logLines, finalTerminalLine, storedStreak }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak,
            sessionWasResumed: false,
            missingAgentNameReported: false,
          });

        expect(streakAfterClassification).toEqual(storedStreak);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(classification.diagnosticLines).toContain(
          terminalReasonExtractionFailedLine(finalTerminalLine),
        );
        expect(classification.diagnosticLines).not.toContain(streakResetLine);
      },
    );
  });

  describe('missing agent', () => {
    it.each([
      {
        label: 'a session limit ending with no stored streak',
        logLines: [sessionLimitEndingLine],
        storedStreak: null,
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 1,
        },
      },
      {
        label:
          'a session limit hit during failed compaction after a rejected rate-limit event',
        logLines: [
          rejectedRateLimitEventLine,
          sessionLimitDuringFailedCompactionEndingLine,
        ],
        storedStreak: null,
        expectedStreak: {
          terminalReason: 'blocking_limit',
          consecutiveFailureCount: 1,
        },
      },
      {
        label:
          'an API Error: Overloaded ending after a rejected rate-limit event reaching count 3',
        logLines: [rejectedRateLimitEventLine, overloadedEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 3,
        },
      },
      {
        label: 'an API Error: Overloaded ending reaching count 6',
        logLines: [overloadedEndingLine],
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 5,
        },
        expectedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 6,
        },
      },
    ])(
      'counts $label without marking it rate-limited or moving it to Failed Preparation',
      async ({ logLines, storedStreak, expectedStreak }) => {
        const { classification, streakAfterClassification } =
          await classifyWorkerSessionEnd({
            logLines,
            storedStreak,
            sessionWasResumed: false,
            missingAgentNameReported: true,
          });

        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(streakAfterClassification).toEqual(expectedStreak);
        expect(classification.diagnosticLines).toContain(
          consecutiveSameReasonFailureLine(
            expectedStreak.terminalReason,
            expectedStreak.consecutiveFailureCount,
          ),
        );
        expect(classification.diagnosticLines).not.toContain(
          consecutiveSameReasonFailureMaxReachedLine(
            expectedStreak.terminalReason,
            expectedStreak.consecutiveFailureCount,
          ),
        );
      },
    );

    it('does not mark a completed ending after a rejected rate-limit event as rate-limited', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [rejectedRateLimitEventLine, completedEndingLine],
          storedStreak: {
            terminalReason: 'api_error',
            consecutiveFailureCount: 2,
          },
          sessionWasResumed: false,
          missingAgentNameReported: true,
        });

      expect(classification.rateLimitRejected).toBe(false);
      expect(classification.moveToFailedPreparation).toBe(false);
      expect(streakAfterClassification).toBeNull();
    });
  });

  describe('prompt too long on resume', () => {
    it.each([
      {
        label:
          'a resumed session ending blocking_limit before making any tool call',
        sessionWasResumed: true,
        logLines: [
          launcherPromptTooLongResumptionLine,
          launcherPromptTooLongSystemInitLine,
          launcherPromptTooLongResultLine('blocking_limit'),
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session ending blocking_limit after making a tool call',
        sessionWasResumed: true,
        logLines: [
          launcherPromptTooLongResumptionLine,
          launcherPromptTooLongSystemInitLine,
          launcherPromptTooLongToolCallLine,
          launcherPromptTooLongResultLine('blocking_limit'),
        ],
        expectedPromptTooLongOnResume: false,
      },
      {
        label:
          'a resumed session whose only tool_use mention is a non-JSON launcher line',
        sessionWasResumed: true,
        logLines: [
          launcherPromptTooLongResumptionLine,
          launcherPromptTooLongTextMentionsToolUseLine,
          launcherPromptTooLongSystemInitLine,
          launcherPromptTooLongResultLine('blocking_limit'),
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a freshly started session ending blocking_limit before any tool call',
        sessionWasResumed: false,
        logLines: [
          launcherPromptTooLongSystemInitLine,
          launcherPromptTooLongResultLine('blocking_limit'),
        ],
        expectedPromptTooLongOnResume: false,
      },
      {
        label: 'a resumed session ending completed before any tool call',
        sessionWasResumed: true,
        logLines: [
          launcherPromptTooLongResumptionLine,
          launcherPromptTooLongSystemInitLine,
          launcherPromptTooLongResultLine('completed'),
        ],
        expectedPromptTooLongOnResume: false,
      },
      {
        label: 'a resumed session ending api_error before any tool call',
        sessionWasResumed: true,
        logLines: [launcherSessionResumptionTextLine, serverErrorEndingLine],
        expectedPromptTooLongOnResume: false,
      },
      {
        label:
          'a resumed session ending blocking_limit with a result other than Prompt is too long',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          blockingLimitContextWindowExceededEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session ending on a session limit hit during failed compaction',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          sessionLimitDuringFailedCompactionEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose tool_use item sits in a user message instead of an assistant message',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          userMessageHoldingToolUseItemLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose assistant line holds "type":"tool_use" only inside a text item',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          assistantTextItemWithNestedToolUseTypeLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose tool_use line parses as a JSON array instead of an object',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          jsonArrayHoldingToolUseItemLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose assistant tool_use line is spaced so it lacks the text "type":"tool_use"',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          spacedAssistantToolUseLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose assistant tool_use line is wrapped in a non-JSON standard error prefix',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          standardErrorWrappedAssistantToolUseLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose assistant line holds a text item and a tool_use item',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          assistantTextAndToolUseLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: false,
      },
      {
        label:
          'a resumed session whose assistant message content is an object holding a tool_use value',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          assistantObjectContentHoldingToolUseLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: false,
      },
      {
        label:
          'a resumed session whose assistant message content is a string quoting tool_use',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          assistantStringContentQuotingToolUseLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
      {
        label:
          'a resumed session whose assistant message content is a string while "type":"tool_use" sits outside the content',
        sessionWasResumed: true,
        logLines: [
          launcherSessionResumptionTextLine,
          assistantStringContentBesideToolUseTypeLine,
          promptTooLongEndingLine,
        ],
        expectedPromptTooLongOnResume: true,
      },
    ])(
      'decides promptTooLongOnResume for $label',
      async ({
        sessionWasResumed,
        logLines,
        expectedPromptTooLongOnResume,
      }) => {
        const { classification } = await classifyWorkerSessionEnd({
          logLines,
          storedStreak: null,
          sessionWasResumed,
          missingAgentNameReported: false,
        });

        expect(classification.promptTooLongOnResume).toBe(
          expectedPromptTooLongOnResume,
        );
      },
    );

    it('still counts a resumed session that ended blocking_limit before any tool call', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [
            launcherSessionResumptionTextLine,
            promptTooLongEndingLine,
          ],
          storedStreak: {
            terminalReason: 'blocking_limit',
            consecutiveFailureCount: 1,
          },
          sessionWasResumed: true,
          missingAgentNameReported: false,
        });

      expect(classification.promptTooLongOnResume).toBe(true);
      expect(classification.rateLimitRejected).toBe(false);
      expect(classification.moveToFailedPreparation).toBe(false);
      expect(streakAfterClassification).toEqual({
        terminalReason: 'blocking_limit',
        consecutiveFailureCount: 2,
      });
      expect(classification.diagnosticLines).toContain(
        consecutiveSameReasonFailureLine('blocking_limit', 2),
      );
    });

    it('still moves a resumed session ending blocking_limit before any tool call to Failed Preparation on the third consecutive failure', async () => {
      const { classification, streakAfterClassification } =
        await classifyWorkerSessionEnd({
          logLines: [
            launcherSessionResumptionTextLine,
            promptTooLongEndingLine,
          ],
          storedStreak: {
            terminalReason: 'blocking_limit',
            consecutiveFailureCount: 2,
          },
          sessionWasResumed: true,
          missingAgentNameReported: false,
        });

      expect(classification.promptTooLongOnResume).toBe(true);
      expect(classification.moveToFailedPreparation).toBe(true);
      expect(classification.sessionErrorLine).toBe(
        failedPreparationSessionErrorLine('blocking_limit', 3),
      );
      expect(streakAfterClassification).toEqual({
        terminalReason: 'blocking_limit',
        consecutiveFailureCount: 3,
      });
    });
  });

  describe('unreadable session log', () => {
    it.each([
      {
        label: 'a stored streak',
        storedStreak: {
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        },
        expectResetLine: true,
      },
      {
        label: 'no stored streak',
        storedStreak: null,
        expectResetLine: false,
      },
    ])(
      'reports the unreadable log, clears every flag and leaves no streak with $label',
      async ({ storedStreak, expectResetLine }) => {
        const workerSessionFailureStreakRepository =
          new InMemoryWorkerSessionFailureStreakRepository();
        if (storedStreak !== null) {
          await workerSessionFailureStreakRepository.save(
            issueUrl,
            storedStreak,
          );
        }
        const useCase = new WorkerSessionEndClassifyUseCase(
          new InMemoryWorkerSessionLogRepository(
            new Map([
              [
                sessionLogFilePath,
                [rejectedRateLimitEventLine, promptTooLongEndingLine],
              ],
            ]),
          ),
          workerSessionFailureStreakRepository,
        );

        const classification = await useCase.run({
          issueUrl,
          sessionLogFilePath: missingSessionLogFilePath,
          sessionWasResumed: true,
          missingAgentNameReported: false,
        });

        expect(classification.diagnosticLines).toContain(
          `worker-session-log-unreadable: ${missingSessionLogFilePath}: ${unreadableErrorMessage(missingSessionLogFilePath)}`,
        );
        expect(classification.moveToFailedPreparation).toBe(false);
        expect(classification.rateLimitRejected).toBe(false);
        expect(classification.promptTooLongOnResume).toBe(false);
        expect(classification.sessionErrorLine).toBeNull();
        expect(
          workerSessionFailureStreakRepository.storedStreakOf(issueUrl),
        ).toBeNull();
        expect(classification.diagnosticLines.includes(streakResetLine)).toBe(
          expectResetLine,
        );
      },
    );
  });

  describe('failing streak repository', () => {
    const workerSessionFailureStreakRepositoryMock = (
      storedStreak: WorkerSessionFailureStreak | null,
    ): {
      findByIssueUrl: jest.Mock<
        Promise<WorkerSessionFailureStreak | null>,
        [string]
      >;
      save: jest.Mock<Promise<void>, [string, WorkerSessionFailureStreak]>;
      deleteByIssueUrl: jest.Mock<Promise<void>, [string]>;
    } => ({
      findByIssueUrl: jest
        .fn<Promise<WorkerSessionFailureStreak | null>, [string]>()
        .mockResolvedValue(storedStreak),
      save: jest
        .fn<Promise<void>, [string, WorkerSessionFailureStreak]>()
        .mockResolvedValue(undefined),
      deleteByIssueUrl: jest
        .fn<Promise<void>, [string]>()
        .mockResolvedValue(undefined),
    });

    const classifyWithStreakRepository = async (
      logLines: string[],
      workerSessionFailureStreakRepository: WorkerSessionFailureStreakRepository,
    ): Promise<WorkerSessionEndClassification> =>
      new WorkerSessionEndClassifyUseCase(
        new InMemoryWorkerSessionLogRepository(
          new Map([[sessionLogFilePath, logLines]]),
        ),
        workerSessionFailureStreakRepository,
      ).run({
        issueUrl,
        sessionLogFilePath,
        sessionWasResumed: false,
        missingAgentNameReported: false,
      });

    it('reports the unreadable streak, counts the api_error ending from one and does not move to Failed Preparation when findByIssueUrl rejects', async () => {
      const workerSessionFailureStreakRepository =
        workerSessionFailureStreakRepositoryMock(null);
      workerSessionFailureStreakRepository.findByIssueUrl.mockRejectedValue(
        new Error('EACCES: permission denied'),
      );

      const classification = await classifyWithStreakRepository(
        [overloadedEndingLine],
        workerSessionFailureStreakRepository,
      );

      expect(classification.diagnosticLines).toContain(
        `worker-session-failure-streak-unreadable: ${issueUrl}: EACCES: permission denied`,
      );
      expect(workerSessionFailureStreakRepository.save).toHaveBeenCalledWith(
        issueUrl,
        { terminalReason: 'api_error', consecutiveFailureCount: 1 },
      );
      expect(classification.moveToFailedPreparation).toBe(false);
    });

    it('reports the unwritable streak and still moves the third consecutive api_error ending to Failed Preparation when save rejects', async () => {
      const workerSessionFailureStreakRepository =
        workerSessionFailureStreakRepositoryMock({
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        });
      workerSessionFailureStreakRepository.save.mockRejectedValue(
        new Error('ENOSPC: no space left on device'),
      );

      const classification = await classifyWithStreakRepository(
        [overloadedEndingLine],
        workerSessionFailureStreakRepository,
      );

      expect(classification.moveToFailedPreparation).toBe(true);
      expect(classification.sessionErrorLine).toBe(
        failedPreparationSessionErrorLine('api_error', 3),
      );
      expect(classification.diagnosticLines).toContain(
        `worker-session-failure-streak-unwritable: ${issueUrl}: ENOSPC: no space left on device`,
      );
    });

    it('reports the undeletable streak in place of the reset line for a completed ending when deleteByIssueUrl rejects', async () => {
      const workerSessionFailureStreakRepository =
        workerSessionFailureStreakRepositoryMock({
          terminalReason: 'api_error',
          consecutiveFailureCount: 2,
        });
      workerSessionFailureStreakRepository.deleteByIssueUrl.mockRejectedValue(
        new Error('EACCES: permission denied'),
      );

      const classification = await classifyWithStreakRepository(
        [assistantToolUseLine, completedEndingLine],
        workerSessionFailureStreakRepository,
      );

      expect(classification.diagnosticLines).toContain(
        `worker-session-failure-streak-undeletable: ${issueUrl}: EACCES: permission denied`,
      );
      expect(classification.diagnosticLines).not.toContain(streakResetLine);
    });
  });
});
