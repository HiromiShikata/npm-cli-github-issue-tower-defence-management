import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractPullRequestRequired = (body: string): boolean | null => {
  const blocks = extractFencedJsonBlocks(body, 'pullRequestRequired');
  const firstBlock = blocks[0];
  if (
    typeof firstBlock !== 'object' ||
    firstBlock === null ||
    !('pullRequestRequired' in firstBlock)
  ) {
    return null;
  }
  const value = Reflect.get(firstBlock, 'pullRequestRequired');
  if (typeof value !== 'boolean') {
    return null;
  }
  return value;
};
