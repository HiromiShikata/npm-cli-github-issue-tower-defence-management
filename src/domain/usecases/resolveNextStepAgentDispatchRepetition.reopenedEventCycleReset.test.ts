import {
  countConsecutiveNoReportDispatches,
  DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
  NO_REPORT_REDISPATCH_COUNT_PREFIX,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';

describe('resolveNextStepAgentDispatchRepetition - reopened-event cycle reset (issue #2814)', () => {
  const trustAll = (): boolean => true;

  type TestComment = { author: string; content: string; createdAt: Date };

  const BASE_TIME = new Date('2026-01-01T00:00:00Z');
  const HOUR_MS = 60 * 60 * 1000;
  const hour = (n: number): Date => new Date(BASE_TIME.getTime() + n * HOUR_MS);

  const namedReport = (
    nextStepAgent: string,
    createdAt: Date,
    author = 'bot',
  ): TestComment => ({
    author,
    content: `From: :robot: ${nextStepAgent} (model)

\`\`\`json
{ "nextStepAgent": "${nextStepAgent}" }
\`\`\`

Report body.`,
    createdAt,
  });

  const nullStepReport = (createdAt: Date, author = 'bot'): TestComment => ({
    author,
    content: `From: :robot: some-agent (model)

\`\`\`json
{ "nextStep": null }
\`\`\`

Report body.`,
    createdAt,
  });

  const humanComment = (createdAt: Date, author = 'bot'): TestComment => ({
    author,
    content: 'Please continue with the second option.',
    createdAt,
  });

  const developerReports = (count: number, startHour: number): TestComment[] =>
    Array.from({ length: count }, (_, index) =>
      namedReport('developer', hour(startHour + index)),
    );

  const nullStepReports = (count: number, startHour: number): TestComment[] =>
    Array.from({ length: count }, (_, index) =>
      nullStepReport(hour(startHour + index)),
    );

  type Case = {
    name: string;
    comments: TestComment[];
    agentFieldValue: string | null;
    nextStepAgent: string | null;
    latestReopenedAt: Date | null;
    expectEscalate: boolean;
  };

  const cases: Case[] = [
    {
      name: '1: 6 reports declaring a mismatched nextStepAgent, no human comment, no reopen -> all 6 counted -> escalate (current behavior preserved)',
      comments: developerReports(6, 1),
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: null,
      expectEscalate: true,
    },
    {
      name: '2: human comment then 5 reports, no reopen -> 5 counted -> no escalation (current behavior preserved)',
      comments: [humanComment(hour(0)), ...developerReports(5, 1)],
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: null,
      expectEscalate: false,
    },
    {
      name: '3: human comment -> reopen (no comment) right after it -> 5 reports -> only the 5 reports after reopen counted -> no escalation (below threshold)',
      comments: [humanComment(hour(0)), ...developerReports(5, 1)],
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: new Date(hour(0).getTime() + 30 * 60 * 1000),
      expectEscalate: false,
    },
    {
      name: '4: human comment -> reopen (no comment) right after it -> 6 reports -> only the 6 reports after reopen counted -> escalate (threshold reached again after reopen)',
      comments: [humanComment(hour(0)), ...developerReports(6, 1)],
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: new Date(hour(0).getTime() + 30 * 60 * 1000),
      expectEscalate: true,
    },
    {
      name: '5: 3 reports -> reopen (no comment) -> 3 reports (6 total spanning the reopen) -> only the 3 reports after reopen counted -> no escalation (this is exactly the bug this issue reports)',
      comments: developerReports(6, 1),
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: new Date(hour(3).getTime() + 30 * 60 * 1000),
      expectEscalate: false,
    },
    {
      name: '6: human comment -> 6 reports -> reopen (no comment) after the 6th (last) report -> zero reports after reopen -> no escalation',
      comments: [humanComment(hour(0)), ...developerReports(6, 1)],
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: new Date(hour(6).getTime() + 30 * 60 * 1000),
      expectEscalate: false,
    },
    {
      name: '7: human comment -> reopen (no comment) -> 6 reports, but the reopened timestamp is BEFORE the human comment (older than the existing boundary) -> human comment stays the boundary -> 6 counted -> escalate (existing boundary logic preserved)',
      comments: [humanComment(hour(0)), ...developerReports(6, 1)],
      agentFieldValue: null,
      nextStepAgent: 'developer',
      latestReopenedAt: new Date(hour(0).getTime() - 30 * 60 * 1000),
      expectEscalate: true,
    },
    {
      name: '8: 6 reports with nextStepAgent null (no next-step agent), no reopen -> all 6 counted -> escalate (matches the real-world incident shape this issue reports)',
      comments: nullStepReports(6, 1),
      agentFieldValue: null,
      nextStepAgent: null,
      latestReopenedAt: null,
      expectEscalate: true,
    },
  ];

  it.each(cases)('$name', (testCase) => {
    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: testCase.agentFieldValue,
      nextStepAgent: testCase.nextStepAgent,
      currentDispatchHasNoReportRejection: false,
      comments: testCase.comments,
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 99,
      thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
      isNoStory: false,
      latestReopenedAt: testCase.latestReopenedAt,
    });

    if (testCase.expectEscalate) {
      expect(result.type).toBe('escalateDispatchLoop');
    } else {
      expect(result.type).not.toBe('escalateDispatchLoop');
    }
  });

  describe('incident reproduction: repeated [agent report, comment-less reopen] cycles', () => {
    it('does not escalate when 5 report+reopen cycles are followed by a single new report after the last reopen', () => {
      const comments = nullStepReports(6, 1);
      const latestReopenedAt = new Date(hour(5).getTime() + 30 * 60 * 1000);

      const result = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: null,
        currentDispatchHasNoReportRejection: false,
        comments,
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: DEFAULT_THRESHOLD_FOR_DISPATCH_LOOP,
        isNoStory: false,
        latestReopenedAt,
      });

      expect(result.type).not.toBe('escalateDispatchLoop');
    });
  });

  describe('resolveStoryUnsetDispatchState reopened-event boundary observed indirectly via resolveNextStepAgentDispatchRepetition with isNoStory true', () => {
    const buildStoryUnsetHistory = (
      nextStepAgent: string,
      dispatchCount: number,
    ): TestComment[] => {
      let history: TestComment[] = [namedReport(nextStepAgent, hour(0))];
      for (
        let dispatchNumber = 1;
        dispatchNumber <= dispatchCount;
        dispatchNumber += 1
      ) {
        const result = resolveNextStepAgentDispatchRepetition({
          agentFieldValue: nextStepAgent,
          nextStepAgent,
          currentDispatchHasNoReportRejection: false,
          comments: history,
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 99,
          thresholdForDispatchLoop: dispatchCount + 1,
          isNoStory: true,
        });
        if (result.type !== 'storyUnset') {
          throw new Error(
            `Expected storyUnset while building the fixture at dispatch ${dispatchNumber}, got ${result.type}`,
          );
        }
        history = [
          history[0],
          {
            author: 'bot',
            content: result.comment,
            createdAt: hour(dispatchNumber),
          },
        ];
      }
      return history;
    };

    it('escalates the story-unset loop with latestReopenedAt null after 5 prior story-unset dispatches embed "(5/6)", but not when the issue was reopened after that last STORY_UNSET comment with nothing posted since', () => {
      const nextStepAgent = 'developer';
      const history = buildStoryUnsetHistory(nextStepAgent, 5);
      const lastStoryUnsetCommentAt = hour(5);

      const withoutReopen = resolveNextStepAgentDispatchRepetition({
        agentFieldValue: nextStepAgent,
        nextStepAgent,
        currentDispatchHasNoReportRejection: false,
        comments: history,
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 99,
        thresholdForDispatchLoop: 6,
        isNoStory: true,
        latestReopenedAt: null,
      });
      expect(withoutReopen.type).toBe('escalateStoryUnsetLoop');

      const withReopenAfterLastComment = resolveNextStepAgentDispatchRepetition(
        {
          agentFieldValue: nextStepAgent,
          nextStepAgent,
          currentDispatchHasNoReportRejection: false,
          comments: history,
          isTrustedAuthor: trustAll,
          thresholdForAutoReject: 99,
          thresholdForDispatchLoop: 6,
          isNoStory: true,
          latestReopenedAt: new Date(
            lastStoryUnsetCommentAt.getTime() + 30 * 60 * 1000,
          ),
        },
      );
      expect(withReopenAfterLastComment.type).not.toBe(
        'escalateStoryUnsetLoop',
      );
      expect(withReopenAfterLastComment.type).toBe('storyUnset');
    });
  });

  describe('countConsecutiveNoReportDispatches reopened-event boundary, verified directly on the exported function', () => {
    const noReportAgainComment = (
      n: number,
      threshold: number,
      createdAt: Date,
      author = 'bot',
    ): TestComment => ({
      author,
      content: `${NO_REPORT_REDISPATCH_COUNT_PREFIX}${n}/${threshold}\n\nNo completion comment was posted.`,
      createdAt,
    });

    it('counts only the NO_REPORT_AGAIN comments after the reopened event, not the ones before it', () => {
      const comments = [
        noReportAgainComment(1, 3, hour(1)),
        noReportAgainComment(2, 3, hour(2)),
        noReportAgainComment(3, 3, hour(3)),
      ];

      const withoutReopen = countConsecutiveNoReportDispatches({
        comments,
        isTrustedAuthor: trustAll,
        latestReopenedAt: null,
      });
      expect(withoutReopen).toBe(3);

      const withReopenBetweenFirstAndSecond =
        countConsecutiveNoReportDispatches({
          comments,
          isTrustedAuthor: trustAll,
          latestReopenedAt: new Date(hour(1).getTime() + 30 * 60 * 1000),
        });
      expect(withReopenBetweenFirstAndSecond).toBe(2);
    });
  });
});
