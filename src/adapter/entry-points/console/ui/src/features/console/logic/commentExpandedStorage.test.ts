import {
  clearAllCommentExpandedStates,
  loadCommentExpandedKeys,
  saveCommentExpandedKeys,
} from './commentExpandedStorage';

const STORAGE_KEY_PREFIX = 'console-comment-expanded:';

describe('loadCommentExpandedKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty set when no entry exists', () => {
    const result = loadCommentExpandedKeys('https://github.com/owner/repo/issues/1');
    expect(result.size).toBe(0);
  });

  it('returns the stored keys as a Set', () => {
    const key = 'https://github.com/owner/repo/issues/1';
    localStorage.setItem(
      STORAGE_KEY_PREFIX + key,
      JSON.stringify(['author:2026-01-01:body']),
    );
    const result = loadCommentExpandedKeys(key);
    expect(result.has('author:2026-01-01:body')).toBe(true);
  });

  it('returns an empty set for malformed JSON', () => {
    const key = 'https://github.com/owner/repo/issues/2';
    localStorage.setItem(STORAGE_KEY_PREFIX + key, 'not-json');
    const result = loadCommentExpandedKeys(key);
    expect(result.size).toBe(0);
  });

  it('returns an empty set when stored value is not an array', () => {
    const key = 'https://github.com/owner/repo/issues/3';
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify({ a: 1 }));
    const result = loadCommentExpandedKeys(key);
    expect(result.size).toBe(0);
  });

  it('filters out non-string entries', () => {
    const key = 'https://github.com/owner/repo/issues/4';
    localStorage.setItem(
      STORAGE_KEY_PREFIX + key,
      JSON.stringify(['valid-key', 42, null]),
    );
    const result = loadCommentExpandedKeys(key);
    expect(result.size).toBe(1);
    expect(result.has('valid-key')).toBe(true);
  });
});

describe('saveCommentExpandedKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves the keys array to localStorage under the prefixed key', () => {
    const key = 'https://github.com/owner/repo/issues/1';
    saveCommentExpandedKeys(key, new Set(['key-a', 'key-b']));
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string);
    expect(parsed).toContain('key-a');
    expect(parsed).toContain('key-b');
  });

  it('overwrites an existing entry', () => {
    const key = 'https://github.com/owner/repo/issues/2';
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(['old-key']));
    saveCommentExpandedKeys(key, new Set(['new-key']));
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    const parsed = JSON.parse(stored as string);
    expect(parsed).toContain('new-key');
    expect(parsed).not.toContain('old-key');
  });

  it('saves an empty array when the set is empty', () => {
    const key = 'https://github.com/owner/repo/issues/3';
    saveCommentExpandedKeys(key, new Set());
    const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    expect(JSON.parse(stored as string)).toEqual([]);
  });
});

describe('clearAllCommentExpandedStates', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes all entries with the comment-expanded prefix', () => {
    const url1 = 'https://github.com/owner/repo/issues/1';
    const url2 = 'https://github.com/owner/repo/issues/2';
    localStorage.setItem(STORAGE_KEY_PREFIX + url1, JSON.stringify(['k1']));
    localStorage.setItem(STORAGE_KEY_PREFIX + url2, JSON.stringify(['k2']));

    clearAllCommentExpandedStates();

    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url1)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_PREFIX + url2)).toBeNull();
  });

  it('does not remove unrelated localStorage entries', () => {
    localStorage.setItem('console-story-show-gray', 'true');
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}https://github.com/owner/repo/issues/1`,
      JSON.stringify(['k']),
    );

    clearAllCommentExpandedStates();

    expect(localStorage.getItem('console-story-show-gray')).toBe('true');
  });

  it('is safe to call when no entries exist', () => {
    expect(() => clearAllCommentExpandedStates()).not.toThrow();
  });

  it('removes all entries regardless of how many exist', () => {
    for (let i = 1; i <= 5; i++) {
      localStorage.setItem(
        `${STORAGE_KEY_PREFIX}https://github.com/owner/repo/issues/${i}`,
        JSON.stringify([`key-${i}`]),
      );
    }
    clearAllCommentExpandedStates();
    expect(localStorage.length).toBe(0);
  });
});
