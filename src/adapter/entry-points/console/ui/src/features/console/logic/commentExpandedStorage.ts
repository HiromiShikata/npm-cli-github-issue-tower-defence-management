const STORAGE_KEY_PREFIX = 'console-comment-expanded:';

export const loadCommentExpandedKeys = (persistenceKey: string): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + persistenceKey);
    if (stored === null) return new Set();
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((k): k is string => typeof k === 'string'));
  } catch (e) {
    console.error('Failed to load comment expanded state from storage:', e);
    return new Set();
  }
};

export const saveCommentExpandedKeys = (
  persistenceKey: string,
  keys: Set<string>,
): void => {
  try {
    localStorage.setItem(
      STORAGE_KEY_PREFIX + persistenceKey,
      JSON.stringify([...keys]),
    );
  } catch (e) {
    console.error('Failed to save comment expanded state to storage:', e);
  }
};

export const clearAllCommentExpandedStates = (): void => {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
};
