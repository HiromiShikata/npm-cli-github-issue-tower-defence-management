import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD } from './nextStepAgentDispatchRepeatedMessage';
import {
  resolveNextStepAgentDispatchRepetition,
  SILENT_CRASH_ESCALATION_PHRASE,
  REPORTING_LOOP_ESCALATION_PHRASE,
  DISPATCH_LOOP_ESCALATION_PHRASE,
} from './resolveNextStepAgentDispatchRepetition';

const trustAll = (): boolean => true;

type TestComment = { author: string; content: string };

const report = (nextStepAgent: string, author = 'bot'): TestComment => ({
  author,
  content: `From: :robot: ${nextStepAgent} (model)

\`\`\`json
{ "nextStepAgent": "${nextStepAgent}" }
\`\`\`

Report body.`,
});

const reportWithoutRouting = (author = 'bot'): TestComment => ({
  author,
  content: 'From: :robot: agent (model)\n\nReport body with no routing block.',
});

const repetitionComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${nextStepAgent}

Dispatching it again.`,
});

const escalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${nextStepAgent}

Failed to receive a report from the dispatched agent for 3 consecutive dispatches since the last human comment. ${SILENT_CRASH_ESCALATION_PHRASE}.`,
});

const reportingEscalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${nextStepAgent}

The agent has been reporting every cycle but cannot advance — it has been dispatched 3 times since the last human comment without resolving the underlying blocker. ${REPORTING_LOOP_ESCALATION_PHRASE}.`,
});

const bareLegacyRepetitionComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${nextStepAgent}`,
});

const dispatchLoopEscalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} ${nextStepAgent}

This agent has been dispatched 3 times since the last human comment on this issue and the task has not moved past it, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`,
});

const humanComment = (author = 'bot'): TestComment => ({
  author,
  content: 'Please carry on with the second option.',
});

describe('resolveNextStepAgentDispatchRepetition', () => {
  describe('silent agent bound', () => {
    it('returns notRepeated when the agent field holds no value', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: null,
          nextStepAgent: 'accounting',
          comments: [report('accounting')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('returns notRepeated when the agent field holds another agent', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: 'triager',
          nextStepAgent: 'accounting',
          comments: [report('accounting')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('returns dispatchAgain with the attempt count when the declared agent is already assigned', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
        comments: [report('accounting')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('matches the agent field and the declared agent ignoring case, spaces and hyphens', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: 'PR Reviewer',
          nextStepAgent: 'pr-reviewer',
          comments: [report('pr-reviewer')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
        }).type,
      ).toBe('dispatchAgain');
    });

    it('counts only repetition comments written by a trusted author', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
        comments: [
          report('accounting', 'bot'),
          repetitionComment('accounting', 'stranger'),
          repetitionComment('accounting', 'stranger'),
        ],
        isTrustedAuthor: (author: string): boolean => author === 'bot',
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('reports against the dispatch loop threshold, not the silent agent one, when the agent did report', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [report('chore'), report('chore')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).toContain('(2/6)');
      expect(comment).not.toContain('ended without a report');
    });

    it('escalates once the repetition count reaches the auto reject threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
        comments: [
          report('accounting'),
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('emits a stuck-agent message when reports are present at escalation', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
        comments: [
          report('accounting'),
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).not.toContain('Failed to receive a report');
      expect(comment.toLowerCase()).toContain('owner');
    });

    it('emits a no-report message when no reports are present at escalation', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
        comments: [
          repetitionComment('accounting'),
          repetitionComment('accounting'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('Failed to receive a report');
    });

    it('counts silent redispatches even when agent name casing in prior comments differs from nextStepAgent', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'pr-reviewer',
        nextStepAgent: 'pr-reviewer',
        comments: [
          report('PR Reviewer'),
          repetitionComment('PR Reviewer'),
          repetitionComment('PR Reviewer'),
          report('PR Reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('does not reset the silent dispatch count when a routing comment is posted after escalation without a human comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
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
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('resets the silent dispatch count after a human comment even if a routing comment follows', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
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
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('resets the count after a previous silent-failure escalation so the first re-dispatch is not immediately re-escalated', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [
          repetitionComment('chore'),
          escalationComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('resets the count after a previous reporting-loop escalation so the first re-dispatch is not immediately re-escalated', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [
          repetitionComment('chore'),
          reportingEscalationComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('still escalates after 3 consecutive failures in the new chain following a previous escalation', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
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
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('does not treat bare legacy repetition comments as escalation resets', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [
          bareLegacyRepetitionComment('chore'),
          bareLegacyRepetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });
  });

  describe('dispatch loop bound', () => {
    it('escalates when two agents alternate until one reaches the dispatch loop threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('escalateDispatchLoop');
      expect(
        result.type === 'escalateDispatchLoop' ? result.comment : '',
      ).toContain('reviewer');
    });

    it('escalates when the same agent is named every round while a fresh report arrives each time', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [report('chore'), report('chore'), report('chore')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('reports the dispatch count against the dispatch loop threshold before escalating', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [report('reviewer'), report('analyst'), report('reviewer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(2/3)',
      );
    });

    it('returns notRepeated for a chain of distinct agents', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: 'analyst',
          nextStepAgent: 'developer',
          comments: [
            report('analyst'),
            report('reviewer'),
            report('developer'),
          ],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 3,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('restarts counting after a human comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [
          report('reviewer'),
          report('analyst'),
          humanComment(),
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(2/3)',
      );
    });

    it('treats a comment from an untrusted author as human input that restarts counting', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [
          report('reviewer', 'bot'),
          report('analyst', 'bot'),
          { author: 'stranger', content: 'A drive-by remark.' },
          report('reviewer', 'bot'),
          report('analyst', 'bot'),
          report('reviewer', 'bot'),
        ],
        isTrustedAuthor: (author: string): boolean => author === 'bot',
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('does not restart counting on its own repetition comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
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
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('does not restart counting on an auto status check comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [
          report('reviewer'),
          report('analyst'),
          {
            author: 'bot',
            content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} PULL_REQUEST_NOT_FOUND`,
          },
          report('reviewer'),
          report('analyst'),
          report('reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('matches the declared agent across reports ignoring case, spaces and hyphens', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'pr-reviewer',
        comments: [
          report('PR Reviewer'),
          report('developer'),
          report('pr-reviewer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 2,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('ignores reports that declare no next step agent', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: 'analyst',
          nextStepAgent: 'reviewer',
          comments: [
            reportWithoutRouting(),
            reportWithoutRouting(),
            report('reviewer'),
          ],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 99,
          thresholdForDispatchLoop: 3,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('resets the dispatch loop count after an escalation comment so one new dispatch does not re-trigger the loop', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: 'chore',
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
      });

      expect(result.type).toBe('notRepeated');
    });
  });
});
