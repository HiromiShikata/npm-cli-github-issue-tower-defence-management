import {
  DUPLICATE_COMMENT_WINDOW_MS,
  isDuplicateWithinWindow,
  normalizeTimestamps,
} from './commentDeduplication';

describe('normalizeTimestamps', () => {
  it('replaces a bare ISO 8601 timestamp with <TS>', () => {
    expect(normalizeTimestamps('Created at 2026-09-05T22:52:54 done')).toBe(
      'Created at <TS> done',
    );
  });

  it('replaces a UTC timestamp ending in Z', () => {
    expect(normalizeTimestamps('2026-09-05T22:52:54Z')).toBe('<TS>');
  });

  it('replaces a timestamp with fractional seconds and Z', () => {
    expect(normalizeTimestamps('2026-09-05T22:52:54.123Z')).toBe('<TS>');
    expect(normalizeTimestamps('2026-09-05T22:52:54.123456Z')).toBe('<TS>');
  });

  it('replaces a timestamp with a positive timezone offset', () => {
    expect(normalizeTimestamps('2026-09-05T22:52:54+09:00')).toBe('<TS>');
  });

  it('replaces a timestamp with a negative timezone offset', () => {
    expect(normalizeTimestamps('2026-09-05T22:52:54-05:00')).toBe('<TS>');
  });

  it('replaces a timestamp with fractional seconds and timezone offset', () => {
    expect(normalizeTimestamps('2026-09-05T22:52:54.999+09:00')).toBe('<TS>');
  });

  it('replaces multiple timestamps in one string', () => {
    const input =
      'From: 2026-09-05T10:00:00Z to 2026-09-05T12:00:00Z took 2 hours';
    expect(normalizeTimestamps(input)).toBe(
      'From: <TS> to <TS> took 2 hours',
    );
  });

  it('leaves non-timestamp content unchanged', () => {
    const input = 'Auto Status Check: REJECTED for issue #123';
    expect(normalizeTimestamps(input)).toBe(input);
  });

  it('does not alter partial date strings that lack the time component', () => {
    expect(normalizeTimestamps('2026-09-05')).toBe('2026-09-05');
  });
});

describe('isDuplicateWithinWindow', () => {
  const TWO_HOURS_MS = DUPLICATE_COMMENT_WINDOW_MS;
  const now = new Date('2026-09-05T12:00:00Z');

  it('returns false when the comment list is empty', () => {
    expect(isDuplicateWithinWindow('hello', [], now)).toBe(false);
  });

  it('returns true when an identical comment was posted within the window', () => {
    const comments = [
      {
        text: 'Auto Status Check: REJECTED',
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
    ];
    expect(
      isDuplicateWithinWindow('Auto Status Check: REJECTED', comments, now),
    ).toBe(true);
  });

  it('returns false when an identical comment was posted before the window', () => {
    const comments = [
      {
        text: 'Auto Status Check: REJECTED',
        createdAt: new Date(now.getTime() - (TWO_HOURS_MS + 1)),
      },
    ];
    expect(
      isDuplicateWithinWindow('Auto Status Check: REJECTED', comments, now),
    ).toBe(false);
  });

  it('returns true for a comment exactly at the window boundary', () => {
    const comments = [
      {
        text: 'Auto Status Check: REJECTED',
        createdAt: new Date(now.getTime() - TWO_HOURS_MS),
      },
    ];
    expect(
      isDuplicateWithinWindow('Auto Status Check: REJECTED', comments, now),
    ).toBe(true);
  });

  it('returns false when the body differs even within the window', () => {
    const comments = [
      {
        text: 'Auto Status Check: REJECTED',
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
    ];
    expect(
      isDuplicateWithinWindow(
        'Auto Status Check: AWAITING_OWNER_APPROVAL',
        comments,
        now,
      ),
    ).toBe(false);
  });

  it('returns true when bodies match after timestamp normalisation', () => {
    const storedComment =
      'CLI error recurrence at 2026-09-05T10:00:00Z: some error';
    const newComment =
      'CLI error recurrence at 2026-09-05T11:30:00Z: some error';
    const comments = [
      {
        text: storedComment,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    ];
    expect(isDuplicateWithinWindow(newComment, comments, now)).toBe(true);
  });

  it('returns false when bodies differ after timestamp normalisation', () => {
    const storedComment =
      'CLI error recurrence at 2026-09-05T10:00:00Z: error A';
    const newComment =
      'CLI error recurrence at 2026-09-05T11:30:00Z: error B';
    const comments = [
      {
        text: storedComment,
        createdAt: new Date(now.getTime() - 60 * 60 * 1000),
      },
    ];
    expect(isDuplicateWithinWindow(newComment, comments, now)).toBe(false);
  });

  it('returns false when an old duplicate exists alongside a non-duplicate within the window', () => {
    const comments = [
      {
        text: 'Auto Status Check: REJECTED',
        createdAt: new Date(now.getTime() - (TWO_HOURS_MS + 1000)),
      },
      {
        text: 'Different comment',
        createdAt: new Date(now.getTime() - 30 * 60 * 1000),
      },
    ];
    expect(
      isDuplicateWithinWindow('Auto Status Check: REJECTED', comments, now),
    ).toBe(false);
  });
});
