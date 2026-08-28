import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const isWaitingForOwnerApproval = (reportContent: string): boolean => {
  const blocks = extractFencedJsonBlocks(
    reportContent,
    'waitingForOwnerApproval',
  );
  const firstBlock = blocks[0];
  if (typeof firstBlock !== 'object' || firstBlock === null) {
    return false;
  }
  const report: Record<string, unknown> = { ...firstBlock };
  return (
    report.pullRequestRequired === false &&
    report.waitingForOwnerApproval === true
  );
};
