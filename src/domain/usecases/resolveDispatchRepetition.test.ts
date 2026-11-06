import {
  AUTO_STATUS_CHECK_MESSAGE_HEAD,
  RATE_LIMIT_SESSION_END_MESSAGE,
  SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE,
} from './autoStatusCheckComments';
import {
  countConsecutiveNoReportDispatches,
  NO_REPORT_REDISPATCH_COUNT_PREFIX,
  resolveDispatchRepetition,
  SILENT_CRASH_ESCALATION_PHRASE,
  REPORTING_LOOP_ESCALATION_PHRASE,
  DISPATCH_LOOP_ESCALATION_PHRASE,
} from './resolveDispatchRepetition';

const trustAll = (): boolean => true;

const TEST_COMMENT_CREATED_AT = new Date('2024-01-01T00:00:00Z');

type TestComment = { author: string; content: string; createdAt: Date };

const report = (agentName: string, author = 'bot'): TestComment => ({
  author,
  content: `From: :robot: ${agentName} (model)

\`\`\`json
{}
\`\`\`

Report body.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const reportWithoutRouting = (author = 'bot'): TestComment => ({
  author,
  content: 'From: :robot: agent (model)\n\nReport body with no routing block.',
  createdAt: TEST_COMMENT_CREATED_AT,
});

const repetitionComment = (agentName: string, author = 'bot'): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_AGAIN ${agentName}

Dispatching it again.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const escalationComment = (agentName: string, author = 'bot'): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} SILENT_REDISPATCH_ESCALATED ${agentName}

Failed to receive a report from the dispatched agent for 3 consecutive dispatches since the last human comment. ${SILENT_CRASH_ESCALATION_PHRASE}.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const reportingEscalationComment = (
  agentName: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} REPORTING_LOOP_ESCALATED ${agentName}

The agent has been reporting every cycle but cannot advance — it has been dispatched 3 times since the last human comment without resolving the underlying blocker. ${REPORTING_LOOP_ESCALATION_PHRASE}.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const bareRepetitionComment = (
  agentName: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_AGAIN ${agentName}`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const dispatchLoopEscalationComment = (
  agentName: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_LOOP_ESCALATED ${agentName}

This agent has been dispatched 3 times since the last human comment on this issue and the task has not moved past it, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const rateLimitRecordComment = (author = 'bot'): TestComment => ({
  author,
  content: RATE_LIMIT_SESSION_END_MESSAGE,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const sessionInterruptedMarkerComment = (author = 'bot'): TestComment => ({
  author,
  content: SESSION_INTERRUPTED_BEFORE_COMPLETION_MESSAGE,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const humanComment = (author = 'bot'): TestComment => ({
  author,
  content: 'Please carry on with the second option.',
  createdAt: TEST_COMMENT_CREATED_AT,
});

const reportWithNullNextStep = (author = 'bot'): TestComment => ({
  author,
  content: `From: :robot: some-agent (model)

\`\`\`json
{ "nextStep": null }
\`\`\`

Report body.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const nullDispatchLoopEscalationComment = (author = 'bot'): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_LOOP_ESCALATED (no next-step agent)

This no-next-step-agent task has been dispatched 3 times since the last human comment without advancing, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

const reportWithoutRoutingBlock = (
  selfDeclaredAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `From: :robot: ${selfDeclaredAgent} (model)

\`\`\`json
{}
\`\`\`

Report body.`,
  createdAt: TEST_COMMENT_CREATED_AT,
});

describe('resolveDispatchRepetition', () => {
  describe('silent agent bound', () => {
    it('returns notRepeated when the agent field holds no value', () => {
      expect(
        resolveDispatchRepetition({
          dependedIssueUrls: [],
          agentFieldValue: null,
          comments: [report('accounting')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
          currentDispatchHasNoReportRejection: false,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('returns dispatchAgain with the attempt count when the declared agent is already assigned', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [report('accounting')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('matches the agent field and the declared agent ignoring case, spaces and hyphens', () => {
      expect(
        resolveDispatchRepetition({
          dependedIssueUrls: [],
          agentFieldValue: 'PR Reviewer',
          comments: [report('pr-reviewer')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
          currentDispatchHasNoReportRejection: true,
        }).type,
      ).toBe('dispatchAgain');
    });

    it('counts only repetition comments written by a trusted author', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          report('accounting', 'bot'),
          repetitionComment('accounting', 'stranger'),
          repetitionComment('accounting', 'stranger'),
        ],
        isTrustedAuthor: (author: string): boolean => author === 'bot',
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('reports against the dispatch loop threshold, not the silent agent one, when the agent did report', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [report('chore'), report('chore')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).toContain('(2/6)');
      expect(comment).not.toContain('ended without a report');
    });

    it('returns dispatchAgain when count is 2 and agent has reported in the cycle', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          report('chore'),
          repetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 99,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('dispatches again for assigned-agent continuation when silent dispatch count reaches threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          report('chore'),
          repetitionComment('chore'),
          report('chore'),
          repetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 99,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('escalates to escalateSilentRedispatch when the agent reported only before the first re-dispatch but not after', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          report('accounting'),
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('escalates to escalateReportingLoop for assigned-agent continuation when agent reports after each re-dispatch and count reaches threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          report('accounting'),
          repetitionComment('accounting'),
          report('accounting'),
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('escalates to escalateSilentRedispatch when the agent never reported in the cycle', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('emits a no-report message when the agent reported only before the first re-dispatch', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          report('accounting'),
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('Failed to receive a report');
    });

    it('emits a no-report message when no reports are present at escalation', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'accounting',
        comments: [
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('Failed to receive a report');
    });

    it('escalates to escalateReportingLoop for assigned-agent continuation when agent name casing in prior comments differs and count reaches threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'pr-reviewer',
        comments: [
          report('PR Reviewer'),
          repetitionComment('PR Reviewer'),
          repetitionComment('PR Reviewer'),
          report('PR Reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('escalates to escalateReportingLoop for assigned-agent continuation when count exceeds threshold and agent reports in cycle', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('resets the silent dispatch count after a human comment even if a routing comment follows', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          humanComment(),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('resets the count after a previous silent-failure escalation so the first re-dispatch is not immediately re-escalated', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          repetitionComment('chore'),
          escalationComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('resets the count after a previous reporting-loop escalation so the first re-dispatch is not immediately re-escalated', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          repetitionComment('chore'),
          reportingEscalationComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('resets the count when a reporting-loop escalation comment uses the legacy phrase', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          repetitionComment('chore'),
          {
            author: 'bot',
            content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} REPORTING_LOOP_ESCALATED chore\n\nOwner judgment is required to break the loop.`,
            createdAt: TEST_COMMENT_CREATED_AT,
          },
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('escalates to escalateReportingLoop for assigned-agent continuation after a previous escalation when count reaches threshold and reports follow re-dispatch', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          repetitionComment('chore'),
          escalationComment('chore'),
          repetitionComment('chore'),
          repetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('escalates to escalateReportingLoop for assigned-agent continuation with bare repetition comments when count reaches threshold and reports follow', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [
          bareRepetitionComment('chore'),
          bareRepetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('still escalates (not storyUnset) when story is set and the cycle count reaches the threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });
  });

  describe('dispatch loop bound', () => {
    it('dispatches again for assigned-agent continuation when same agent is named every round', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'chore',
        comments: [report('chore'), report('chore'), report('chore')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('treats a comment from an untrusted author as human input that restarts counting', () => {
      const dispatchLoopResult = (
        comments: TestComment[],
      ): ReturnType<typeof resolveDispatchRepetition> =>
        resolveDispatchRepetition({
          dependedIssueUrls: [],
          agentFieldValue: 'analyst',
          comments,
          isTrustedAuthor: (author: string): boolean => author === 'bot',
          thresholdForAutoReject: 99,
          thresholdForDispatchLoop: 3,
          currentDispatchHasNoReportRejection: false,
        });
      const drivebyRemark: TestComment = {
        author: 'stranger',
        content: 'A drive-by remark.',
        createdAt: TEST_COMMENT_CREATED_AT,
      };

      expect(
        dispatchLoopResult([
          report('analyst'),
          report('analyst'),
          drivebyRemark,
          report('analyst'),
        ]).type,
      ).toBe('notRepeated');
      expect(
        dispatchLoopResult([
          report('analyst'),
          report('analyst'),
          drivebyRemark,
          report('analyst'),
          report('analyst'),
          report('analyst'),
        ]).type,
      ).toBe('escalateDispatchLoop');
    });

    it('does not restart counting on its own repetition comment', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'analyst',
        comments: [
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
          repetitionComment('reviewer'),
          report('analyst'),
          report('reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('does not restart counting on an auto status check comment', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'analyst',
        comments: [
          report('reviewer'),
          report('analyst'),
          {
            author: 'bot',
            content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} PULL_REQUEST_NOT_FOUND`,
            createdAt: TEST_COMMENT_CREATED_AT,
          },
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('matches the declared agent across reports ignoring case, spaces and hyphens', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('PR Reviewer'),
          report('developer'),
          report('pr-reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 2,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('ignores reports that declare without routing data', () => {
      expect(
        resolveDispatchRepetition({
          dependedIssueUrls: [],
          agentFieldValue: 'analyst',
          comments: [
            reportWithoutRouting(),
            reportWithoutRouting(),
            report('reviewer'),
          ],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 99,
          thresholdForDispatchLoop: 3,
          currentDispatchHasNoReportRejection: false,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('resets the dispatch loop count after an escalation comment so one new dispatch does not re-trigger the loop', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          report('chore'),
          report('chore'),
          report('chore'),
          dispatchLoopEscalationComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('notRepeated');
    });
  });

  describe('no assigned target', () => {
    it('returns notRepeated when fewer null-nextStep reports exist than the dispatch loop threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [reportWithNullNextStep(), reportWithNullNextStep()],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('notRepeated');
    });

    it('returns escalateDispatchLoop when null-nextStep reports reach the dispatch loop threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('uses the no-next-step-agent label in the escalation comment', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      const comment =
        result.type === 'escalateDispatchLoop' ? result.comment : '';
      expect(comment).toContain('(no next-step agent)');
    });

    it('uses the task-wide dispatch loop message body', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      const comment =
        result.type === 'escalateDispatchLoop' ? result.comment : '';
      expect(comment).toContain(
        'This no-next-step-agent task has been dispatched',
      );
    });

    it('resets the null dispatch count after a human comment', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          humanComment('human'),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: (author) => author !== 'human',
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('notRepeated');
    });

    it('resets the null dispatch count after a null dispatch loop escalation comment', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          nullDispatchLoopEscalationComment(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: false,
      });

      expect(result.type).toBe('notRepeated');
    });
  });

  describe('legitimate multi-session continuation', () => {
    it('does not report no-report-received when the agent reported its own name', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [report('developer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).not.toContain('No report has been received');
    });

    it('does not report no-report-received when the agent reported its own name again after a prior re-dispatch', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).not.toContain('No report has been received');
    });

    it('does claim no-report-received when a prior report named the agent but it never reported', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [report('triager')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).toContain('No report has been received');
    });
  });

  describe('assigned agent continuation', () => {
    it('escalates to escalateReportingLoop for assigned-agent continuation when agent reports beyond threshold', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          report('developer'),
          repetitionComment('developer'),
          report('developer'),
          repetitionComment('developer'),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateReportingLoop');
    });

    it('dispatches again for assigned-agent continuation when same agent is dispatched beyond dispatch loop threshold', () => {
      const manyDispatches = [
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
      ];
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: manyDispatches,
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('should still escalate silent redispatch when agent does not report after assigned-agent continuation', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });
  });

  describe('currentDispatchHasNoReportRejection (a dispatch for which no agent report was found)', () => {
    it('does not return notRepeated when a silent dispatch of a real agentFieldValue happens with no routing block and no prior history', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it.each([
      {
        description:
          'agentFieldValue is null so there is nobody to attribute the silent dispatch to',
        agentFieldValue: null,
        currentDispatchHasNoReportRejection: true,
      },
      {
        description:
          'currentDispatchHasNoReportRejection is false so the flag changes nothing',
        agentFieldValue: 'developer',
        currentDispatchHasNoReportRejection: false,
      },
    ])(
      'returns notRepeated when $description',
      ({ agentFieldValue, currentDispatchHasNoReportRejection }) => {
        expect(
          resolveDispatchRepetition({
            dependedIssueUrls: [],
            agentFieldValue,
            comments: [],
            isTrustedAuthor: trustAll,
            thresholdForAutoReject: 3,
            thresholdForDispatchLoop: 6,
            currentDispatchHasNoReportRejection,
          }),
        ).toEqual({ type: 'notRepeated' });
      },
    );

    it('escalates to escalateSilentRedispatch when a silent dispatch pushes a self-referencing agent already one short of the threshold to the limit', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('developer');
      expect(comment).not.toContain(' null');
    });

    it('does not escalate through escalateDispatchLoop when a silent dispatch of the currently-assigned agent occurs, even with many prior comments', () => {
      const result = resolveDispatchRepetition({
        dependedIssueUrls: [],
        agentFieldValue: 'developer',
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        currentDispatchHasNoReportRejection: true,
      });

      expect(result.type).toBe('dispatchAgain');
    });
  });
});

describe('countDispatchesInCurrentCycle assigned-agent attribution fix', () => {
  it('excludes a report from a different agent dispatched elsewhere so the cross-agent count no longer reaches the dispatch loop threshold (table case 1)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        reportWithoutRoutingBlock('other-agent'),
        reportWithoutRoutingBlock('developer'),
        reportWithoutRoutingBlock('developer'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: 3,
      currentDispatchHasNoReportRejection: false,
    });

    expect(result.type).toBe('notRepeated');
  });

  it('still escalates to escalateDispatchLoop when every report self-declares the agent field value (table case 2, regression check)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        reportWithoutRoutingBlock('developer'),
        reportWithoutRoutingBlock('developer'),
        reportWithoutRoutingBlock('developer'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: 3,
      currentDispatchHasNoReportRejection: false,
    });

    expect(result.type).toBe('escalateDispatchLoop');
  });
});

describe('countSilentRedispatches hasReportsAfterFirstRedispatch cross-agent attribution fix', () => {
  it('does not treat a report from a different agent after the first silent redispatch as evidence the dispatched agent itself reported (table case 4)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        repetitionComment('developer'),
        reportWithoutRoutingBlock('other-agent'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 2,
      thresholdForDispatchLoop: 99,
      currentDispatchHasNoReportRejection: true,
    });

    expect(result.type).toBe('escalateSilentRedispatch');
  });

  it('still treats a same-agent report after the first silent redispatch as evidence the dispatched agent reported (table case 5, regression check)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        repetitionComment('developer'),
        reportWithoutRoutingBlock('developer'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 2,
      thresholdForDispatchLoop: 99,
      currentDispatchHasNoReportRejection: true,
    });

    expect(result.type).toBe('escalateReportingLoop');
  });
});

describe('isRateLimitSilentFailureExclusionActive target-agent attribution fix', () => {
  it('preserves the post-rate-limit grace period on the self-redispatch path when an unrelated agent report follows the rate-limit record (table case 6)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        rateLimitRecordComment(),
        reportWithoutRoutingBlock('other-agent'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 1,
      thresholdForDispatchLoop: 99,
      currentDispatchHasNoReportRejection: true,
    });

    expect(result.type).toBe('dispatchAgain');
    expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
      '(1/1)',
    );
  });

  it('leaves the escalation result unaffected when no rate-limit record exists in the comment history (table case 10, regression check)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'developer',
      comments: [
        repetitionComment('developer'),
        repetitionComment('developer'),
        repetitionComment('developer'),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 99,
      currentDispatchHasNoReportRejection: true,
    });

    expect(result.type).toBe('escalateSilentRedispatch');
  });
});

describe('rate-limit record boundary (parameterized test cases 1-7)', () => {
  it.each([
    {
      description:
        'human comment then 3 silent-failure detections with no rate-limit record escalates (regression check)',
      comments: [
        humanComment(),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'escalateSilentRedispatch',
      expectedCommentContains: undefined,
    },
    {
      description:
        'rate-limit record then 2 silent-failure detections redispatches normally (threshold not reached)',
      comments: [rateLimitRecordComment(), repetitionComment('accounting')],
      expectedType: 'dispatchAgain',
      expectedCommentContains: '(2/3)',
    },
    {
      description:
        'rate-limit record then 3 silent-failure detections redispatches normally instead of escalating (bug reproduction)',
      comments: [
        rateLimitRecordComment(),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'dispatchAgain',
      expectedCommentContains: '(3/3)',
    },
    {
      description:
        'rate-limit record then an agent response then 3 silent-failure detections escalates (response ends the exclusion)',
      comments: [
        rateLimitRecordComment(),
        report('accounting'),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'escalateSilentRedispatch',
      expectedCommentContains: 'Failed to receive a report',
    },
    {
      description:
        'rate-limit record then a human comment then 3 silent-failure detections escalates (human comment is the new boundary)',
      comments: [
        rateLimitRecordComment(),
        humanComment(),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'escalateSilentRedispatch',
      expectedCommentContains: undefined,
    },
    {
      description:
        'two rate-limit records then 3 silent-failure detections redispatches normally (most recent rate-limit record is the boundary)',
      comments: [
        rateLimitRecordComment(),
        rateLimitRecordComment(),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'dispatchAgain',
      expectedCommentContains: '(3/3)',
    },
    {
      description:
        '3 silent-failure detections with no human comment, reopened event, or rate-limit record ever posted still escalates (found-check guards against -1 === -1)',
      comments: [
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      expectedType: 'escalateSilentRedispatch',
      expectedCommentContains: undefined,
    },
  ])('$description', ({ comments, expectedType, expectedCommentContains }) => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: 'accounting',
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: true,
    });

    expect(result.type).toBe(expectedType);
    if (expectedCommentContains !== undefined && 'comment' in result) {
      expect(result.comment).toContain(expectedCommentContains);
    }
  });
});

describe('countConsecutiveNoReportDispatches', () => {
  const noReportAgainComment = (
    n: number,
    threshold: number,
    author = 'bot',
  ): TestComment => ({
    author,
    content: `${NO_REPORT_REDISPATCH_COUNT_PREFIX}${n}/${threshold}\n\nNo completion comment was posted.`,
    createdAt: TEST_COMMENT_CREATED_AT,
  });

  it('returns 0 when there are no comments', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(0);
  });

  it('returns 0 when there are no NO_REPORT_AGAIN comments', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [humanComment(), report('developer')],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(0);
  });

  it('returns 1 when there is one NO_REPORT_AGAIN comment and no human comment or agent report', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [noReportAgainComment(1, 3)],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(1);
  });

  it('returns 2 when there are two NO_REPORT_AGAIN comments in sequence', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [noReportAgainComment(1, 3), noReportAgainComment(2, 3)],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(2);
  });

  it('resets to 0 after a human comment', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          humanComment(),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(0);
  });

  it('counts only NO_REPORT_AGAIN comments after the last human comment', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          humanComment(),
          noReportAgainComment(1, 3),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(1);
  });

  it('resets to 0 after an agent report', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(0);
  });

  it('counts only NO_REPORT_AGAIN comments after the last agent report', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          report('developer'),
          noReportAgainComment(1, 3),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(1);
  });

  it('ignores NO_REPORT_AGAIN comments from untrusted authors', () => {
    const trustNone = (): boolean => false;
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3, 'untrusted-user'),
          noReportAgainComment(2, 3, 'untrusted-user'),
        ],
        isTrustedAuthor: trustNone,
        agentFieldValue: 'developer',
      }),
    ).toBe(0);
  });

  it('does not merge NO_REPORT_AGAIN comments across a rate-limit record boundary into a single count (AC8 regression check)', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          rateLimitRecordComment(),
          noReportAgainComment(1, 3),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(1);
  });

  it('excludes a report from a different agent dispatched elsewhere from resetting the streak, so the NO_REPORT_AGAIN count keeps accumulating through it (table case 8)', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [
          noReportAgainComment(1, 3),
          noReportAgainComment(2, 3),
          reportWithoutRoutingBlock('other-agent'),
          noReportAgainComment(1, 3),
        ],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(3);
  });

  it('still returns the same consecutive count when no report-type comment is present (table case 9, regression check)', () => {
    expect(
      countConsecutiveNoReportDispatches({
        comments: [noReportAgainComment(1, 3), noReportAgainComment(2, 3)],
        isTrustedAuthor: trustAll,
        agentFieldValue: 'developer',
      }),
    ).toBe(2);
  });
});

describe('sessionEndedWithoutCompletingTurn (issue 3325)', () => {
  it('returns sessionInterruptedBeforeCompletion instead of counting toward the dispatch loop when the current dispatch was interrupted before completing its turn (criterion 6)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: null,
      comments: [reportWithNullNextStep()],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
      sessionEndedWithoutCompletingTurn: true,
    });

    expect(result.type).toBe('sessionInterruptedBeforeCompletion');
    if (result.type === 'sessionInterruptedBeforeCompletion') {
      expect(
        result.comment.startsWith(
          'Auto Status Check: SESSION_INTERRUPTED_BEFORE_COMPLETION (no next-step agent)',
        ),
      ).toBe(true);
    }
  });

  it('still escalates to escalateDispatchLoop when sessionEndedWithoutCompletingTurn is explicitly false and null-nextStep reports reach the dispatch loop threshold (criterion 8, pinning)', () => {
    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: null,
      comments: [
        reportWithNullNextStep(),
        reportWithNullNextStep(),
        reportWithNullNextStep(),
      ],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 3,
      currentDispatchHasNoReportRejection: false,
      sessionEndedWithoutCompletingTurn: false,
    });

    expect(result.type).toBe('escalateDispatchLoop');
  });

  it('does not trigger escalateDispatchLoop when every non-advancing report since the last human comment is preceded by its own session-interrupted marker (criteria 9 and 10)', () => {
    const comments: TestComment[] = [];
    for (let pairIndex = 0; pairIndex < 6; pairIndex += 1) {
      comments.push(sessionInterruptedMarkerComment());
      comments.push(reportWithNullNextStep());
    }

    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: null,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
      sessionEndedWithoutCompletingTurn: false,
    });

    expect(result.type).toBe('notRepeated');
  });

  it('escalates to escalateDispatchLoop for the same 6 non-advancing reports when no session-interrupted marker resets the boundary (regression sanity check, not one of the 10 numbered criteria)', () => {
    const comments: TestComment[] = [
      reportWithNullNextStep(),
      reportWithNullNextStep(),
      reportWithNullNextStep(),
      reportWithNullNextStep(),
      reportWithNullNextStep(),
      reportWithNullNextStep(),
    ];

    const result = resolveDispatchRepetition({
      dependedIssueUrls: [],
      agentFieldValue: null,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
      sessionEndedWithoutCompletingTurn: false,
    });

    expect(result.type).toBe('escalateDispatchLoop');
  });
});

describe('dependedIssueUrls guard (criterion 4, issue 3413)', () => {
  const singleDependedIssueUrl = ['https://github.com/user/repo/issues/999'];
  const multipleDependedIssueUrls = [
    'https://github.com/user/repo/issues/999',
    'https://github.com/user/repo/issues/1000',
  ];

  it.each([
    {
      description:
        'an escalateSilentRedispatch-shaped history (agent never reported since being silently redispatched to the threshold)',
      dependedIssueUrls: singleDependedIssueUrl,
      agentFieldValue: 'accounting',
      comments: [
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
    },
    {
      description:
        'an escalateReportingLoop-shaped history (agent reports every cycle but never advances past the threshold)',
      dependedIssueUrls: singleDependedIssueUrl,
      agentFieldValue: 'accounting',
      comments: [
        report('accounting'),
        repetitionComment('accounting'),
        report('accounting'),
        repetitionComment('accounting'),
        repetitionComment('accounting'),
      ],
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
    },
    {
      description:
        'an escalateDispatchLoop-shaped history (two agents alternate past the dispatch loop threshold)',
      dependedIssueUrls: singleDependedIssueUrl,
      agentFieldValue: 'analyst',
      comments: [
        report('reviewer'),
        report('analyst'),
        report('reviewer'),
        report('analyst'),
        report('reviewer'),
      ],
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 3,
      currentDispatchHasNoReportRejection: false,
    },
    {
      description:
        'a self-referencing agent with a plain non-escalating history and multiple dependedIssueUrls entries',
      dependedIssueUrls: multipleDependedIssueUrls,
      agentFieldValue: 'chore',
      comments: [report('chore')],
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: false,
    },
    {
      description:
        'no assigned target with currentDispatchHasNoReportRejection true, which would otherwise attribute the silent dispatch to the agent field',
      dependedIssueUrls: singleDependedIssueUrl,
      agentFieldValue: 'developer',
      comments: [
        repetitionComment('developer'),
        repetitionComment('developer'),
      ],
      thresholdForAutoReject: 3,
      thresholdForDispatchLoop: 6,
      currentDispatchHasNoReportRejection: true,
    },
  ])(
    'returns notRepeated when dependedIssueUrls is non-empty, regardless of $description',
    ({ description: _description, ...params }) => {
      expect(
        resolveDispatchRepetition({
          ...params,
          isTrustedAuthor: trustAll,
        }),
      ).toEqual({ type: 'notRepeated' });
    },
  );
});
