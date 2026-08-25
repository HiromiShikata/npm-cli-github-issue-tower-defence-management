import { formatFullTimestamp, formatRelativeTime } from './relativeTime';

const now = Date.parse('2026-06-19T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('returns just now for very recent times', () => {
    expect(formatRelativeTime('2026-06-19T11:59:30.000Z', now)).toBe(
      'just now',
    );
  });

  it('returns minutes ago', () => {
    expect(formatRelativeTime('2026-06-19T11:45:00.000Z', now)).toBe(
      '15 minutes ago',
    );
  });

  it('uses singular for one minute', () => {
    expect(formatRelativeTime('2026-06-19T11:59:00.000Z', now)).toBe(
      '1 minute ago',
    );
  });

  it('returns hours ago', () => {
    expect(formatRelativeTime('2026-06-19T09:00:00.000Z', now)).toBe(
      '3 hours ago',
    );
  });

  it('returns yesterday for one day', () => {
    expect(formatRelativeTime('2026-06-18T12:00:00.000Z', now)).toBe(
      'yesterday',
    );
  });

  it('returns days ago for under a month', () => {
    expect(formatRelativeTime('2026-06-09T12:00:00.000Z', now)).toBe(
      '10 days ago',
    );
  });

  it('returns month and day for 30+ days in the same UTC year', () => {
    expect(formatRelativeTime('2026-05-01T12:00:00.000Z', now)).toBe('May 1');
  });

  it('includes the UTC year when the date is in a prior year', () => {
    const result = formatRelativeTime('2025-12-01T12:00:00.000Z', now);
    expect(result).toContain('2025');
    expect(result).toContain('Dec');
  });

  it('uses UTC date boundary for the same-year check', () => {
    const nowEndOf2025 = Date.parse('2025-12-31T23:59:59.000Z');
    const result = formatRelativeTime('2025-10-01T00:00:00.000Z', nowEndOf2025);
    expect(result).toContain('Oct');
    expect(result).not.toContain('2025');
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('nonsense', now)).toBe('');
  });
});

describe('formatFullTimestamp', () => {
  it('formats a UTC timestamp in ja-JP locale', () => {
    expect(formatFullTimestamp('2026-06-19T09:05:00.000Z')).toMatch(
      /2026.06.19.09.05/,
    );
  });

  it('returns empty string for invalid input', () => {
    expect(formatFullTimestamp('nonsense')).toBe('');
  });
});
