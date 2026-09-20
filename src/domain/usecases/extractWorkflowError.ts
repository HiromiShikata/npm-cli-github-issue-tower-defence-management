import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractWorkflowError = (body: string): string | null => {
  const blocks = extractFencedJsonBlocks(body, 'workflowError');
  const lastBlock = blocks[blocks.length - 1];
  if (typeof lastBlock !== 'object' || lastBlock === null) {
    return null;
  }
  if (!('workflowError' in lastBlock)) {
    return null;
  }
  const value = Reflect.get(lastBlock, 'workflowError');
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
};
