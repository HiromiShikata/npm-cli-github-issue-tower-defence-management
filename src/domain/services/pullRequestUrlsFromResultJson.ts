const FENCED_JSON_BLOCK_PATTERN = /```json[^\n]*\n([\s\S]*?)```/g;

const PULL_REQUEST_URL_IN_RESULT_PATTERN =
  /"pullRequestUrl"\s*:\s*"(https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+)"/g;

export const pullRequestUrlsFromCommentBodies = (
  commentBodies: string[],
): string[] => {
  const urls: string[] = [];
  for (const body of commentBodies) {
    for (const fenced of body.matchAll(FENCED_JSON_BLOCK_PATTERN)) {
      for (const match of fenced[1].matchAll(
        PULL_REQUEST_URL_IN_RESULT_PATTERN,
      )) {
        if (!urls.includes(match[1])) {
          urls.push(match[1]);
        }
      }
    }
  }
  return urls;
};
