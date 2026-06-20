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

  it('returns an empty string for an invalid date', () => {
    expect(formatRelativeTime('nonsense', now)).toBe('');
  });
});

describe('formatFullTimestamp', () => {
  it('formats a timestamp and returns empty for invalid input', () => {
    expect(formatFullTimestamp('2026-06-19T12:00:00.000Z')).not.toBe('');
    expect(formatFullTimestamp('nonsense')).toBe('');
  });
});
