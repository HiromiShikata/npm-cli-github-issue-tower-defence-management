import {
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  resolveDispatchRepetition,
} from './resolveDispatchRepetition';
import { REACTIVATION_TRIGGER_COMMENT_HEAD } from './dependencyNotificationCommentHeads';

describe('resolveDispatchRepetition - recurring periodic check must not over-count toward the dispatch loop threshold', () => {
  const trustAll = (): boolean => true;

  const TEST_COMMENT_CREATED_AT = new Date('2024-01-01T00:00:00Z');

  type TestComment = { author: string; content: string; createdAt: Date };

  const periodicCheckReport = (
    agentName: string,
    author = 'bot',
  ): TestComment => ({
    author,
    content: `From: :robot: ${agentName} (model)

\`\`\`json
{}
\`\`\`

Hourly check: no actionable change found this cycle, rescheduled for the next hour.`,
    createdAt: TEST_COMMENT_CREATED_AT,
  });

  const reactivationTriggerConfirmedComment = (
    author = 'bot',
  ): TestComment => ({
    author,
    content: `${REACTIVATION_TRIGGER_COMMENT_HEAD}\n- Depended Issue URL: not set\n- Next Action Date: not set\n- Next Action Hour: 15`,
    createdAt: TEST_COMMENT_CREATED_AT,
  });

  it("pins current behavior: repeated periodic-check reports with no human or escalation comment in between reach the dispatch loop threshold (documents today's over-counting, unfixed code)", () => {
    const comments: TestComment[] = Array.from(
      { length: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP },
      () => periodicCheckReport('media-patrol'),
    );

    const result = resolveDispatchRepetition({
      agentFieldValue: null,
      currentDispatchHasNoReportRejection: false,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      dependedIssueUrls: [],
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

    const result = resolveDispatchRepetition({
      agentFieldValue: null,
      currentDispatchHasNoReportRejection: false,
      comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      dependedIssueUrls: [],
    });

    expect(result.type).not.toBe('escalateDispatchLoop');
  });
});
