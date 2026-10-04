import { loadCommentDrafts, saveCommentDrafts } from './commentDraftStorage';

const STORAGE_KEY = 'console-comment-drafts';

describe('saveCommentDrafts then loadCommentDrafts round trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const roundTripCases: { name: string; drafts: Map<string, string> }[] = [
    {
      name: 'a single task draft',
      drafts: new Map([['PVTI_1', 'work in progress']]),
    },
    {
      name: 'drafts for multiple different tasks',
      drafts: new Map([
        ['PVTI_1', 'draft for task one'],
        ['PVTI_2', 'draft for task two'],
      ]),
    },
    {
      name: 'an empty map',
      drafts: new Map<string, string>(),
    },
  ];

  it.each(roundTripCases)(
    'loadCommentDrafts returns the same map that was saved for $name',
    ({ drafts }) => {
      saveCommentDrafts(drafts);
      const loaded = loadCommentDrafts();
      expect(loaded).toEqual(drafts);
    },
  );
});

describe('loadCommentDrafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty map when nothing was ever saved', () => {
    const loaded = loadCommentDrafts();
    expect(loaded).toEqual(new Map());
  });

  const corruptedStorageCases: { name: string; stored: string }[] = [
    { name: 'a non-JSON string', stored: 'not-json{{{' },
    {
      name: 'a JSON object instead of an array',
      stored: JSON.stringify({ PVTI_1: 'draft' }),
    },
    {
      name: 'a JSON array of plain strings, not [string, string] pairs',
      stored: JSON.stringify(['just-a-string', 'another-string']),
    },
    {
      name: 'a JSON array of numbers',
      stored: JSON.stringify([1, 2, 3]),
    },
  ];

  it.each(corruptedStorageCases)(
    'returns an empty map without throwing when the stored value is $name',
    ({ stored }) => {
      localStorage.setItem(STORAGE_KEY, stored);
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        let loaded: Map<string, string> | undefined;
        expect(() => {
          loaded = loadCommentDrafts();
        }).not.toThrow();
        expect(loaded).toEqual(new Map());
      } finally {
        errorSpy.mockRestore();
      }
    },
  );

  it('returns a previously stored draft unchanged, performing no age or timestamp check, after many days have passed', () => {
    const drafts = new Map([
      ['PVTI_1', 'still unsent after several days'],
    ]);
    saveCommentDrafts(drafts);

    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-12-31T23:59:59.000Z'));
      const loaded = loadCommentDrafts();
      expect(loaded).toEqual(drafts);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('saveCommentDrafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('catches and does not propagate a write failure such as quota exceeded', () => {
    const setItemSpy = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        saveCommentDrafts(new Map([['PVTI_1', 'unsaved draft']])),
      ).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
