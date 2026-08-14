import type { ConsoleComment } from './types';

const commentIdentity = (comment: ConsoleComment): string =>
  JSON.stringify([comment.author, comment.createdAt, comment.body]);

export const mergePostedComments = (
  loadedComments: ConsoleComment[],
  postedComments: ConsoleComment[],
): ConsoleComment[] => {
  const loadedIdentities = new Set(loadedComments.map(commentIdentity));
  return [
    ...loadedComments,
    ...postedComments.filter(
      (comment) => !loadedIdentities.has(commentIdentity(comment)),
    ),
  ];
};
