import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractNextStepAgent = (body: string): string | null => {
  for (const block of extractFencedJsonBlocks(body, 'nextStepAgent')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('nextStepAgent' in block)) {
      continue;
    }
    const value = Reflect.get(block, 'nextStepAgent');
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }
    return value.trim();
  }
  return null;
};
