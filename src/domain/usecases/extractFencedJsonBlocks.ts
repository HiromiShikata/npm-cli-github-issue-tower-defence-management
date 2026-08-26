import { normalizeReportBody } from './normalizeReportBody';

export const extractFencedJsonBlocks = (
  body: string,
  context: string,
): unknown[] => {
  const blocks: unknown[] = [];
  for (const match of normalizeReportBody(body).matchAll(
    /```json\n([\s\S]*?)\n```/g,
  )) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch (error) {
      console.warn(
        `Invalid JSON in report body while checking ${context}:`,
        error,
      );
    }
  }
  return blocks;
};
