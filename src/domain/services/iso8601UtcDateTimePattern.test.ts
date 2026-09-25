import { ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE } from './iso8601UtcDateTimePattern';

describe('ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE', () => {
  it('is exactly the shared core date-time digit-group regex source', () => {
    expect(ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE).toBe(
      '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}',
    );
  });

  it('matches an ISO-8601 date-time up to whole seconds when anchored', () => {
    const pattern = new RegExp(
      '^' + ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE + '$',
    );
    expect(pattern.test('2026-01-31T09:00:00')).toBe(true);
  });

  it('does not match a date-only string when anchored', () => {
    const pattern = new RegExp(
      '^' + ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE + '$',
    );
    expect(pattern.test('2026-01-31')).toBe(false);
  });

  it('does not match a timestamp carrying a trailing Z when anchored, since the core has no Z', () => {
    const pattern = new RegExp(
      '^' + ISO_8601_UTC_DATE_TIME_CORE_PATTERN_SOURCE + '$',
    );
    expect(pattern.test('2026-01-31T09:00:00Z')).toBe(false);
  });
});
