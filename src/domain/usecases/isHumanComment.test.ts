import { AUTO_STATUS_CHECK_MESSAGE_HEAD } from './autoStatusCheckComments';
import {
  ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD,
  ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD,
  CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDENCY_REMOVED_COMMENT_HEAD,
  DEPENDED_ISSUE_URLS_COMMENT_HEAD,
  SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD,
  SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD,
} from './dependencyNotificationCommentHeads';
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

  it('treats a depended issue URLs comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${DEPENDED_ISSUE_URLS_COMMENT_HEAD}\n- https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats an all-depended-closed-cleared comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${ALL_DEPENDED_CLOSED_CLEARED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats a some-depended-closed-removed comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${SOME_DEPENDED_CLOSED_REMOVED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats an all-depended-icebox-cleared comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${ALL_DEPENDED_ICEBOX_CLEARED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats a some-depended-icebox-removed comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${SOME_DEPENDED_ICEBOX_REMOVED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats a dependency-removed comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${DEPENDENCY_REMOVED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
        },
        trustAll,
      ),
    ).toBe(false);
  });

  it('treats a circular-dependency-removed comment as machine generated', () => {
    expect(
      isHumanComment(
        {
          author: 'bot',
          content: `${CIRCULAR_DEPENDENCY_REMOVED_COMMENT_HEAD} https://github.com/owner/repo/issues/1`,
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
