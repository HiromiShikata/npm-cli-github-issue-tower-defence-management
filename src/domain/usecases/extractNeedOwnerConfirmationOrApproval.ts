import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractNeedOwnerConfirmationOrApproval = (
  body: string,
): boolean => {
  const blocks = extractFencedJsonBlocks(
    body,
    'needOwnerConfirmationOrApproval',
  );
  const lastBlock = blocks[blocks.length - 1];
  if (typeof lastBlock !== 'object' || lastBlock === null) {
    return false;
  }
  if (!('needOwnerConfirmationOrApproval' in lastBlock)) {
    return false;
  }
  const value = Reflect.get(lastBlock, 'needOwnerConfirmationOrApproval');
  return value === true;
};
