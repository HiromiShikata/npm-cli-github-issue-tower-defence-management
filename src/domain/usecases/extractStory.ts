import { extractFencedJsonBlocks } from './extractFencedJsonBlocks';

export const extractStory = (body: string): string | null => {
  for (const block of extractFencedJsonBlocks(body, 'story')) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    if (!('story' in block)) {
      continue;
    }
    const value = Reflect.get(block, 'story');
    if (typeof value !== 'string' || value.trim() === '') {
      continue;
    }
    return value.trim();
  }
  return null;
};
