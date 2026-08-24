export const normalizeReportBody = (body: string): string =>
  body.replace(/\\`/g, '`').replace(/\r\n/g, '\n');
