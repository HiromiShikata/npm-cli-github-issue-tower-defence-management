export const DUPLICATE_COMMENT_WINDOW_MS = 2 * 60 * 60 * 1000;

const ISO_8601_TIMESTAMP_PATTERN =
  /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:?\d{2})?/g;

export function normalizeTimestamps(body: string): string {
  return body.replace(ISO_8601_TIMESTAMP_PATTERN, '<TS>');
}

export function isDuplicateWithinWindow(
  newBody: string,
  existingComments: ReadonlyArray<{ text: string; createdAt: Date }>,
  now: Date,
): boolean {
  const normalizedNew = normalizeTimestamps(newBody);
  const windowStart = new Date(now.getTime() - DUPLICATE_COMMENT_WINDOW_MS);
  return existingComments.some(
    (c) =>
      c.createdAt >= windowStart &&
      normalizeTimestamps(c.text) === normalizedNew,
  );
}
