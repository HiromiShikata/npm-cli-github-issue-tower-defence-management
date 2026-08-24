import {
  NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD,
  resolveNextStepAgentDispatchRepetition,
} from './resolveNextStepAgentDispatchRepetition';

const trustAll = (): boolean => true;

describe('resolveNextStepAgentDispatchRepetition', () => {
  it('returns notRepeated when the agent field holds no value', () => {
    expect(
      resolveNextStepAgentDispatchRepetition({
        agentFieldValue: null,
        nextStepAgent: 'accounting',
        commentsAfterLastAgentReport: [],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
      }),
    ).toEqual({ type: 'notRepeated' });
  });

  it('returns notRepeated when the agent field holds another agent', () => {
    expect(
      resolveNextStepAgentDispatchRepetition({
        agentFieldValue: 'triager',
        nextStepAgent: 'accounting',
        commentsAfterLastAgentReport: [],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
      }),
    ).toEqual({ type: 'notRepeated' });
  });

  it('returns dispatchAgain with the attempt count when the declared agent is already assigned', () => {
    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: 'accounting',
      nextStepAgent: 'accounting',
      commentsAfterLastAgentReport: [],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
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
        commentsAfterLastAgentReport: [],
        isTrustedAuthor: trustAll,
        thresholdForAutoReject: 3,
      }).type,
    ).toBe('dispatchAgain');
  });

  it('counts only repetition comments written by a trusted author', () => {
    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: 'accounting',
      nextStepAgent: 'accounting',
      commentsAfterLastAgentReport: [
        {
          author: 'stranger',
          content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} accounting`,
        },
        {
          author: 'stranger',
          content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} accounting`,
        },
      ],
      isTrustedAuthor: (author: string): boolean => author === 'bot',
      thresholdForAutoReject: 3,
    });

    expect(result.type).toBe('dispatchAgain');
  });

  it('escalates once the repetition count reaches the auto reject threshold', () => {
    const repeated = {
      author: 'bot',
      content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} accounting`,
    };

    const result = resolveNextStepAgentDispatchRepetition({
      agentFieldValue: 'accounting',
      nextStepAgent: 'accounting',
      commentsAfterLastAgentReport: [repeated, repeated],
      isTrustedAuthor: trustAll,
      thresholdForAutoReject: 3,
    });

    expect(result.type).toBe('escalateToFailedPreparation');
  });
});
