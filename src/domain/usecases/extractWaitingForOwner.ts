import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractWaitingForOwner = (body: string): boolean => {
  for (const block of extractFencedJsonBlocks(body, 'waitingForOwner')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('waitingForOwner' in block)) {
      continue;
    }
    return Reflect.get(block, 'waitingForOwner') === true;
  }
  return false;
};
