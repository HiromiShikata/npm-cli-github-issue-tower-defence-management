import {
  nextPendingKeyAfter,
  nextPendingKeyBrowse,
  previousPendingKeyBefore,
} from './navigation';

const keys = ['a', 'b', 'c', 'd'];

describe('nextPendingKeyAfter', () => {
  it('returns the key immediately after the acted key', () => {
    expect(nextPendingKeyAfter(keys, 'b')).toBe('c');
  });

  it('returns null when the acted key is last so the caller returns to the list', () => {
    expect(nextPendingKeyAfter(keys, 'd')).toBeNull();
  });

  it('falls back to the first key when the acted key is absent', () => {
    expect(nextPendingKeyAfter(keys, 'missing')).toBe('a');
  });

  it('returns null for an empty list', () => {
    expect(nextPendingKeyAfter([], 'a')).toBeNull();
  });
});

describe('nextPendingKeyBrowse', () => {
  it('returns the next key in display order', () => {
    expect(nextPendingKeyBrowse(keys, 'a')).toBe('b');
  });

  it('returns null at the end of the list', () => {
    expect(nextPendingKeyBrowse(keys, 'd')).toBeNull();
  });

  it('returns null when the current key is absent', () => {
    expect(nextPendingKeyBrowse(keys, 'missing')).toBeNull();
  });
});

describe('previousPendingKeyBefore', () => {
  it('returns the previous key in display order', () => {
    expect(previousPendingKeyBefore(keys, 'c')).toBe('b');
  });

  it('returns null at the start of the list', () => {
    expect(previousPendingKeyBefore(keys, 'a')).toBeNull();
  });

  it('returns null when the current key is absent', () => {
    expect(previousPendingKeyBefore(keys, 'missing')).toBeNull();
  });
});
