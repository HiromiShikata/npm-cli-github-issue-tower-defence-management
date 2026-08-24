import { SystemDateRepository } from './SystemDateRepository';

describe('SystemDateRepository', () => {
  const repo = new SystemDateRepository();

  const jan15At09h05 = new Date(Date.UTC(2026, 0, 15, 9, 5, 0));
  const jan15At10h30 = new Date(Date.UTC(2026, 0, 15, 10, 30, 0));
  const jan16At08h00 = new Date(Date.UTC(2026, 0, 16, 8, 0, 0));

  describe('formatDurationToHHMM', () => {
    it('formats whole hours', () => {
      expect(repo.formatDurationToHHMM(120)).toBe('02:00');
    });

    it('formats hours and minutes', () => {
      expect(repo.formatDurationToHHMM(90)).toBe('01:30');
    });

    it('formats minutes only', () => {
      expect(repo.formatDurationToHHMM(5)).toBe('00:05');
    });
  });

  describe('formatDateWithDayOfWeek', () => {
    it('formats a UTC date with day-of-week in YYYY/MM/DD (Day) form', () => {
      expect(repo.formatDateWithDayOfWeek(jan15At09h05)).toBe(
        '2026/01/15 (Thu)',
      );
    });
  });

  describe('formatDateTimeWithDayOfWeek', () => {
    it('appends UTC HH:MM to the date-with-day-of-week', () => {
      expect(repo.formatDateTimeWithDayOfWeek(jan15At09h05)).toBe(
        '2026/01/15 (Thu) 09:05',
      );
    });

    it('pads single-digit hour and minute', () => {
      const date = new Date(Date.UTC(2026, 2, 3, 4, 7, 0));
      expect(repo.formatDateTimeWithDayOfWeek(date)).toBe(
        '2026/03/03 (Tue) 04:07',
      );
    });
  });

  describe('formatStartEnd', () => {
    it('omits the date for same-day end', () => {
      expect(repo.formatStartEnd(jan15At09h05, jan15At10h30)).toBe(
        '2026/01/15 (Thu) 09:05 - 10:30',
      );
    });

    it('includes full date-time for end on a different day', () => {
      expect(repo.formatStartEnd(jan15At09h05, jan16At08h00)).toBe(
        '2026/01/15 (Thu) 09:05 - 2026/01/16 (Fri) 08:00',
      );
    });
  });
});
