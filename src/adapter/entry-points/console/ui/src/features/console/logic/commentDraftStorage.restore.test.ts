import {
  loadCommentDrafts,
  mergeRestoredCommentDraft,
  restoreCommentDraftInStorage,
} from './commentDraftStorage';

const STORAGE_KEY = 'console-comment-drafts';

describe('mergeRestoredCommentDraft', () => {
  it.each([
    [
      'no newer draft',
      '',
      'Checked during the flight.',
      'Checked during the flight.',
    ],
    [
      'whitespace-only draft',
      ' \n ',
      'Checked during the flight.',
      'Checked during the flight.',
    ],
    [
      'newer text not containing the body',
      'Follow up later',
      'Checked during the flight.',
      'Checked during the flight.\n\nFollow up later',
    ],
    [
      'newer draft that already contains the body',
      'Checked during the flight.\n\nFollow up later',
      'Checked during the flight.',
      'Checked during the flight.\n\nFollow up later',
    ],
  ])(
    'restores the body for %s without overwriting newer text',
    (_name, current, restored, expected) => {
      expect(mergeRestoredCommentDraft(current, restored)).toBe(expected);
    },
  );
});

describe('restoreCommentDraftInStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('persists the restored body under its item key and keeps every other item draft', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([['PVTI_9', 'draft for another item']]),
    );

    const drafts = restoreCommentDraftInStorage(
      'PVTI_2',
      'Checked during the flight.',
    );

    expect(drafts.get('PVTI_2')).toBe('Checked during the flight.');
    expect(loadCommentDrafts().get('PVTI_2')).toBe(
      'Checked during the flight.',
    );
    expect(loadCommentDrafts().get('PVTI_9')).toBe('draft for another item');
  });

  it('merges into a newer draft already persisted for the same item', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([['PVTI_2', 'Follow up later']]),
    );

    restoreCommentDraftInStorage('PVTI_2', 'Checked during the flight.');

    expect(loadCommentDrafts().get('PVTI_2')).toBe(
      'Checked during the flight.\n\nFollow up later',
    );
  });
});
