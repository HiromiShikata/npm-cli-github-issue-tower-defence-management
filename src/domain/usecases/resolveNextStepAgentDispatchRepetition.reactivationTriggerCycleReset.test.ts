import {
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';
import { REACTIVATION_TRIGGER_COMMENT_HEAD } from './dependencyNotificationCommentHeads';

describe('resolveNextStepAgentDispatchRepetition - recurring periodic check must not over-count toward the dispatch loop threshold', () => {
  const trustAll = (): boolean => true;

  type TestComment = { author: string; content: string };

  const periodicCheckReport = (
    nextStepAgent: string,
    author = 'bot',
  ): TestComment => ({
    author,
    content: `From: :robot: ${nextStepAgent} (model)

\`\`\`json
{ "nextStepAgent": "${nextStepAgent}" }
\`\`\`

Hourly check: no actionable change found this cycle, rescheduled for the next hour.`,
  });

  const reactivationTriggerConfirmedComment = (
    author = 'bot',
  ): TestComment => ({
    author,
    content: `${REACTIVATION_TRIGGER_COMMENT_HEAD}\n- Depended Issue URL: not set\n- Next Action Date: not set\n- Next Action Hour: 15`,
  });

  it("pins current behavior: repeated periodic-check reports with no human or escalation comment in between reach the dispatch loop threshold (documents today's over-counting, unfixed code)", () => {
    const comments: TestComment[] = Array.from(
      { length: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP },
      () => periodicCheckReport('media-patrol'),
    );

    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: null,
      nextStepAgent: 'media-patrol',
      currentDispatchHasNoReportRejection: false,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      isNoStory: false,
    });

    expect(result.type).toBe('escalateDispatchLoop');
  });

  it('BUG: must not escalate the dispatch loop when every periodic check correctly confirmed a fresh Reactivation Trigger before the next dispatch (fails against unfixed code)', () => {
    const comments: TestComment[] = [];
    for (let i = 0; i < DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP; i += 1) {
      comments.push(periodicCheckReport('media-patrol'));
      if (i < DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP - 1) {
        comments.push(reactivationTriggerConfirmedComment());
      }
    }

    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: null,
      nextStepAgent: 'media-patrol',
      currentDispatchHasNoReportRejection: false,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      isNoStory: false,
    });

    expect(result.type).not.toBe('escalateDispatchLoop');
  });
});
