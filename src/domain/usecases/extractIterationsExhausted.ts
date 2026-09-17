import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractIterationsExhausted = (body: string): boolean => {
  for (const block of extractFencedJsonBlocks(body, 'iterationsExhausted')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('iterationsExhausted' in block)) {
      continue;
    }
    return Reflect.get(block, 'iterationsExhausted') === true;
  }
  return false;
};
