import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractNextStepAgent = (body: string): string | null => {
  const blocks = extractFencedJsonBlocks(body, 'nextStepAgent');
  const lastBlock = blocks[blocks.length - 1];
  if (typeof lastBlock !== 'object' || lastBlock === null) {
    return null;
  }
  if (!('nextStepAgent' in lastBlock)) {
    return null;
  }
  const value = Reflect.get(lastBlock, 'nextStepAgent');
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value.trim();
};
