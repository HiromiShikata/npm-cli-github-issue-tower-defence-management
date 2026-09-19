import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
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
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_AGAIN ${nextStepAgent}

Dispatching it again.`,
});

const escalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} SILENT_REDISPATCH_ESCALATED ${nextStepAgent}

Failed to receive a report from the dispatched agent for 3 consecutive dispatches since the last human comment. ${SILENT_CRASH_ESCALATION_PHRASE}.`,
});

const reportingEscalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} REPORTING_LOOP_ESCALATED ${nextStepAgent}

The agent has been reporting every cycle but cannot advance — it has been dispatched 3 times since the last human comment without resolving the underlying blocker. ${REPORTING_LOOP_ESCALATION_PHRASE}.`,
});

const bareRepetitionComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_AGAIN ${nextStepAgent}`,
});

const dispatchLoopEscalationComment = (
  nextStepAgent: string,
  author = 'bot',
): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_LOOP_ESCALATED ${nextStepAgent}

This agent has been dispatched 3 times since the last human comment on this issue and the task has not moved past it, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`,
});

const humanComment = (author = 'bot'): TestComment => ({
  author,
  content: 'Please carry on with the second option.',
});

const reportWithNullNextStep = (author = 'bot'): TestComment => ({
  author,
  content: `From: :robot: some-agent (model)

\`\`\`json
{ "nextStep": null }
\`\`\`

Report body.`,
});

const nullDispatchLoopEscalationComment = (author = 'bot'): TestComment => ({
  author,
  content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} DISPATCH_LOOP_ESCALATED (no next-step agent)

This no-next-step-agent task has been dispatched 3 times since the last human comment without advancing, so ${DISPATCH_LOOP_ESCALATION_PHRASE} instead of being dispatched again.`,
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
          isNoStory: false,
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
          isNoStory: false,
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
        isNoStory: false,
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
          isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).toContain('(2/6)');
      expect(comment).not.toContain('ended without a report');
    });

    it('returns dispatchAgain when count is 2 and agent has reported in the cycle', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [
          report('chore'),
          repetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 99,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('dispatches again for self-reference when silent dispatch count reaches threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('escalates to escalateSilentRedispatch when the agent reported only before the first re-dispatch but not after', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('dispatches again for self-reference when agent reports after each re-dispatch beyond threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'accounting',
        nextStepAgent: 'accounting',
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('escalates to escalateSilentRedispatch when the agent never reported in the cycle', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });

    it('emits a no-report message when the agent reported only before the first re-dispatch', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('Failed to receive a report');
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
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
      const comment =
        result.type === 'escalateSilentRedispatch' ? result.comment : '';
      expect(comment).toContain('Failed to receive a report');
    });

    it('dispatches again for self-reference when agent name casing in prior comments differs', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('dispatches again for self-reference when routing comments appear after escalation without a human comment', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
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
        isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
      expect(result.type === 'dispatchAgain' ? result.comment : '').toContain(
        '(1/3)',
      );
    });

    it('dispatches again for self-reference after a previous escalation when reports follow re-dispatch', () => {
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('dispatches again for self-reference with bare repetition comments when reports follow', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [
          bareRepetitionComment('chore'),
          bareRepetitionComment('chore'),
          report('chore'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
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
        isNoStory: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
      expect(
        result.type === 'escalateDispatchLoop' ? result.comment : '',
      ).toContain('reviewer');
    });

    it('dispatches again for self-reference when same agent is named every round', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'chore',
        nextStepAgent: 'chore',
        comments: [report('chore'), report('chore'), report('chore')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('reports the dispatch count against the dispatch loop threshold before escalating', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'analyst',
        nextStepAgent: 'reviewer',
        comments: [report('reviewer'), report('analyst'), report('reviewer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
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
          isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
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
        isNoStory: false,
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
          isNoStory: false,
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
        isNoStory: false,
      });

      expect(result.type).toBe('notRepeated');
    });
  });

  describe('no-story guard', () => {
    it('returns storyUnset instead of dispatchAgain when story is unset and the designated agent is already assigned', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [report('developer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: true,
      });

      expect(result.type).toBe('storyUnset');
    });

    it('returns notRepeated when story is unset and the agent field is null', () => {
      expect(
        resolveNextStepAgentDispatchRepetition({
          agentFieldValue: null,
          nextStepAgent: 'developer',
          comments: [report('developer')],
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 3,
          thresholdForDispatchLoop: 6,
          isNoStory: true,
        }),
      ).toEqual({ type: 'notRepeated' });
    });

    it('returns storyUnset instead of escalateSilentRedispatch when story is unset and the cycle count reaches the threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: true,
      });

      expect(result.type).toBe('storyUnset');
    });

    it('storyUnset comment mentions the designated agent name', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [report('developer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: true,
      });

      const comment = result.type === 'storyUnset' ? result.comment : '';
      expect(comment).toContain('developer');
    });

    it('storyUnset comment does not contain the crash escalation phrase', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [report('developer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: true,
      });

      const comment = result.type === 'storyUnset' ? result.comment : '';
      expect(comment).not.toContain('crashed');
      expect(comment).not.toContain('silently');
    });

    it('still escalates (not storyUnset) when story is set and the cycle count reaches the threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });
  });

  describe('null nextStepAgent', () => {
    it('returns notRepeated when fewer null-nextStep reports exist than the dispatch loop threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [reportWithNullNextStep(), reportWithNullNextStep()],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      expect(result.type).toBe('notRepeated');
    });

    it('returns escalateDispatchLoop when null-nextStep reports reach the dispatch loop threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      expect(result.type).toBe('escalateDispatchLoop');
    });

    it('uses the no-next-step-agent label in the escalation comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      const comment =
        result.type === 'escalateDispatchLoop' ? result.comment : '';
      expect(comment).toContain('(no next-step agent)');
    });

    it('uses the null-specific dispatch loop message body', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      const comment =
        result.type === 'escalateDispatchLoop' ? result.comment : '';
      expect(comment).toContain('no-next-step-agent task');
    });

    it('resets the null dispatch count after a human comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          humanComment('human'),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: (author) => author !== 'human',
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      expect(result.type).toBe('notRepeated');
    });

    it('resets the null dispatch count after a null dispatch loop escalation comment', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        comments: [
          reportWithNullNextStep(),
          reportWithNullNextStep(),
          nullDispatchLoopEscalationComment(),
          reportWithNullNextStep(),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 3,
        isNoStory: false,
      });

      expect(result.type).toBe('notRepeated');
    });
  });

  describe('legitimate multi-session continuation', () => {
    it('does not report no-report-received when the agent nominated itself in its own report', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [report('developer')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).not.toContain('No report has been received');
    });

    it('does not report no-report-received when the agent re-nominated itself after a prior re-dispatch', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          report('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).not.toContain('No report has been received');
    });

    it('does claim no-report-received when a prior agent nominated the agent but it never reported', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [report('triager')],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
      const comment = result.type === 'dispatchAgain' ? result.comment : '';
      expect(comment).toContain('No report has been received');
    });
  });

  describe('self-reference (nextStepAgent equals agentFieldValue)', () => {
    it('dispatches again for self-reference when agent reports beyond threshold', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
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
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('dispatches again for self-reference when same agent is dispatched beyond dispatch loop threshold', () => {
      const manyDispatches = [
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
        report('developer'),
      ];
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: manyDispatches,
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('dispatchAgain');
    });

    it('should still escalate silent redispatch when agent does not report after self-nomination', () => {
      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'developer',
        nextStepAgent: 'developer',
        comments: [
          report('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
          repetitionComment('developer'),
        ],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
        thresholdForDispatchLoop: 6,
        isNoStory: false,
      });

      expect(result.type).toBe('escalateSilentRedispatch');
    });
  });
});
