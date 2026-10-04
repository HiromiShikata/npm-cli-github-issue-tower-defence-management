const STORAGE_KEY = 'console-comment-drafts';

export const loadCommentDrafts = (): Map<string, string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return new Map();
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Map();
    return new Map(
      parsed.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          entry.length === 2 &&
          typeof entry[0] === 'string' &&
          typeof entry[1] === 'string',
      ),
    );
  } catch (e) {
    console.error('Failed to load comment drafts from storage:', e);
    return new Map();
  }
};

export const saveCommentDrafts = (drafts: Map<string, string>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...drafts]));
  } catch (e) {
    console.error('Failed to save comment drafts to storage:', e);
  }
};
