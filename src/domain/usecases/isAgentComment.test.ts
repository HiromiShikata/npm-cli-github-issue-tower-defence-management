import { isAgentComment, TrustedAuthorCheck } from './isAgentComment';
import { Comment } from '../entities/Comment';

const OWNER_LOGIN = 'HiromiShikata';
const UNTRUSTED_LOGIN = 'outside-contributor';

const isTrustedAuthor: TrustedAuthorCheck = (author) => author === OWNER_LOGIN;

const createComment = (params: {
  author?: string;
  content: string;
}): Comment => ({
  author: params.author ?? OWNER_LOGIN,
  content: params.content,
  createdAt: new Date('2026-10-02T08:40:52Z'),
  updatedAt: new Date('2026-10-02T08:40:52Z'),
});

describe('isAgentComment', () => {
  it('returns true for a trusted-author comment whose body starts with the agent report prefix', () => {
    const comment = createComment({
      content:
        'From: :robot: developer (example-model)\n\nThe implementation is waiting for the owner decision.',
    });

    expect(isAgentComment(comment, isTrustedAuthor)).toBe(true);
  });

  it('returns true for a trusted-author comment whose body carries a trailing fenced JSON object, even without the agent report prefix', () => {
    const comment = createComment({
      content: '```json\n{"nextStepAgent": null}\n```',
    });

    expect(isAgentComment(comment, isTrustedAuthor)).toBe(true);
  });

  it('returns false for an untrusted author even when the body starts with the agent report prefix', () => {
    const comment = createComment({
      author: UNTRUSTED_LOGIN,
      content:
        'From: :robot: developer (example-model)\n\nThe implementation is waiting for the owner decision.',
    });

    expect(isAgentComment(comment, isTrustedAuthor)).toBe(false);
  });

  it('returns false for an untrusted author even when the body carries a trailing fenced JSON object', () => {
    const comment = createComment({
      author: UNTRUSTED_LOGIN,
      content: '```json\n{"nextStepAgent": null}\n```',
    });

    expect(isAgentComment(comment, isTrustedAuthor)).toBe(false);
  });

  it('returns false for a trusted-author comment whose body matches neither the prefix shape nor the fenced JSON shape', () => {
    const comment = createComment({
      content: 'Any update on this?',
    });

    expect(isAgentComment(comment, isTrustedAuthor)).toBe(false);
  });
});
