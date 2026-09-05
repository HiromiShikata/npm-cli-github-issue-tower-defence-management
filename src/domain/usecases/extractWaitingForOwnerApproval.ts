import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractWaitingForOwnerApproval = (body: string): boolean => {
  for (const block of extractFencedJsonBlocks(body, 'waitingForOwnerApproval')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('waitingForOwnerApproval' in block)) {
      continue;
    }
    const value = Reflect.get(block, 'waitingForOwnerApproval');
    if (value === true) {
      return true;
    }
  }
  return false;
};
