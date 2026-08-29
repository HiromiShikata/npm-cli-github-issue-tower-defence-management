import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import { isHumanComment } from './isHumanComment';
import { NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD } from './nextStepAgentDispatchRepeatedMessage';

const trustAll = (): boolean => true;

describe('isHumanComment', () => {
  it('treats a plain comment from a trusted author as human input', () => {
    expect(
      isHumanComment(
        { author: 'bot', content: 'Please use the second option.' },
        trustAll,
      ),
    ).toBe(true);
  });

  it('treats an agent report as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: 'From: :robot: agent (model)\n\nReport body.',
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats an agent report whose leading fenced block precedes the prefix as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content:
            '```json\n{ "nextStepAgent": "developer" }\n```\n\nFrom: :robot: agent (model)\n\nReport body.',
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats the dispatch repetition comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${NEXT_STEP_AGENT_DISPATCH_REPEATED_MESSAGE_HEAD} developer\n\nDispatching it again.`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats an auto status check comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${AUTO_STATUS_CHECK_MESSAGE_HEAD} PULL_REQUEST_NOT_FOUND`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats any comment from an untrusted author as human input', () => {
    expect(
      isHumanComment(
        {
          author: 'stranger',
          content: 'From: :robot: agent (model)\n\nImpersonated report.',
        },
        (author: string): boolean => author === 'bot',
      ),
    ).toBe(true);
  });
});
