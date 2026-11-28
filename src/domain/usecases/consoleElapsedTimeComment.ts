export const CONSOLE_ELAPSED_TIME_MARKER = '<!-- tdpm-console-elapsed-time -->';

export const formatConsoleElapsedTimeLine = (
  elapsedMs: number,
  actionDescription: string,
): string => {
  const minutes = Math.floor(elapsedMs / 60_000);
  const seconds = Math.floor((elapsedMs % 60_000) / 1_000);
  return `コンソールで開いてから ${minutes}分${seconds}秒 で${actionDescription}${CONSOLE_ELAPSED_TIME_MARKER}`;
};

export const appendConsoleElapsedTimeLine = (
  body: string,
  line: string,
): string => `${body}\n\n${line}`;

export const isConsoleElapsedTimeCommentBody = (body: string): boolean =>
  body.includes(CONSOLE_ELAPSED_TIME_MARKER);

export const stripConsoleElapsedTimeLine = (body: string): string => {
  const markerIndex = body.lastIndexOf(CONSOLE_ELAPSED_TIME_MARKER);
  if (markerIndex < 0 || body.slice(markerIndex).includes('\n')) {
    return body;
  }
  const lineStart = body.lastIndexOf('\n\n', markerIndex);
  if (lineStart < 0) {
    return body.includes('\n') ? body : '';
  }
  return body.slice(0, lineStart);
};

export const shouldRecordConsoleElapsedTime = (itemUrl: string): boolean => {
  const match =
    /^https:\/\/github\.com\/([^/]+)\/[^/]+\/(issues|pull)\/\d+$/.exec(itemUrl);
  return match?.[1] === 'HiromiShikata';
};
