export const normalizeReportBody = (body: string): string =>
  body.replace(/\\`/g, '`');
