import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractWorkflowError = (body: string): string | null => {
  for (const block of extractFencedJsonBlocks(body, 'workflowError')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('workflowError' in block)) {
      continue;
    }
    const value = Reflect.get(block, 'workflowError');
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }
    return value.trim();
  }
  return null;
};
