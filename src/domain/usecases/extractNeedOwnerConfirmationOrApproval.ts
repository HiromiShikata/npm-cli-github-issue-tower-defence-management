import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractNeedOwnerConfirmationOrApproval = (
  body: string,
): boolean => {
  for (const block of extractFencedJsonBlocks(
    body,
    'needOwnerConfirmationOrApproval',
  )) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('needOwnerConfirmationOrApproval' in block)) {
      continue;
    }
    const value = Reflect.get(block, 'needOwnerConfirmationOrApproval');
    if (value === true) {
      return true;
    }
  }
  return false;
};
