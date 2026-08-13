export const AUTO_STATUS_CHECK_MESSAGE_HEAD = 'Auto Status Check:';

export const dropTrailingAutoStatusCheckComments = <
  T extends { author: string; content: string },
>(
  comments: T[],
  isTrustedAuthor: (author: string) => boolean,
): T[] => {
  let endIndex = comments.length;
  while (
    endIndex > 0 &&
    isTrustedAuthor(comments[endIndex - 1].author) &&
    comments[endIndex - 1].content.startsWith(AUTO_STATUS_CHECK_MESSAGE_HEAD)
  ) {
    endIndex -= 1;
  }
  return comments.slice(0, endIndex);
};
