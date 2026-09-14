import { mergePostedComments } from './postedComments';
import type { ConsoleComment } from './types';

const loadedComment: ConsoleComment = {
  author: 'HiromiShikata',
  body: 'Loaded from GitHub.',
  createdAt: '2026-06-19T10:00:00.000Z',
};

const postedComment: ConsoleComment = {
  author: 'HiromiShikata',
  body: 'Posted from the console.',
  createdAt: '2026-06-19T11:58:00.000Z',
};

describe('mergePostedComments', () => {
  it('appends a posted comment after the loaded comments', () => {
    expect(mergePostedComments([loadedComment], [postedComment])).toEqual([
      loadedComment,
      postedComment,
    ]);
  });

  it('drops a posted comment that the reloaded comments already carry', () => {
    expect(
      mergePostedComments([loadedComment, postedComment], [postedComment]),
    ).toEqual([loadedComment, postedComment]);
  });

  it('keeps a posted comment whose body differs from an otherwise identical loaded comment', () => {
    const editedComment: ConsoleComment = {
      ...postedComment,
      body: 'Posted from the console, then edited.',
    };
    expect(mergePostedComments([postedComment], [editedComment])).toEqual([
      postedComment,
      editedComment,
    ]);
  });

  it('returns the loaded comments unchanged when nothing was posted', () => {
    expect(mergePostedComments([loadedComment], [])).toEqual([loadedComment]);
  });
});
