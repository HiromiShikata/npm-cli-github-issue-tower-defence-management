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

export const mergeRestoredCommentDraft = (
  current: string,
  restored: string,
): string => {
  if (current.trim().length === 0) {
    return restored;
  }
  if (current.includes(restored)) {
    return current;
  }
  return `${restored}\n\n${current}`;
};

export const restoreCommentDraftInStorage = (
  itemKey: string,
  body: string,
): Map<string, string> => {
  const drafts = loadCommentDrafts();
  drafts.set(
    itemKey,
    mergeRestoredCommentDraft(drafts.get(itemKey) ?? '', body),
  );
  saveCommentDrafts(drafts);
  return drafts;
};

const removeRestoredCommentBody = (current: string, body: string): string => {
  if (current === body) {
    return '';
  }
  const prefix = `${body}\n\n`;
  return current.startsWith(prefix) ? current.slice(prefix.length) : current;
};

export const releaseRestoredCommentDraftInStorage = (
  itemKey: string,
  body: string,
): Map<string, string> => {
  const drafts = loadCommentDrafts();
  const remaining = removeRestoredCommentBody(drafts.get(itemKey) ?? '', body);
  if (remaining.trim().length === 0) {
    drafts.delete(itemKey);
  } else {
    drafts.set(itemKey, remaining);
  }
  saveCommentDrafts(drafts);
  return drafts;
};
