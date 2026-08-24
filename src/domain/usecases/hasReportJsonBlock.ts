import { normalizeReportBody } from './normalizeReportBody';

export const hasReportJsonBlock = (body: string): boolean =>
  /```json\n[\s\S]*?\n```/.test(normalizeReportBody(body));
