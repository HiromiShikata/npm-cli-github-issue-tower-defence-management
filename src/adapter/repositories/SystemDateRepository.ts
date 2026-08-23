import { DateRepository } from '../../domain/usecases/adapter-interfaces/DateRepository';

export class SystemDateRepository implements DateRepository {
  now = async () => new Date();
  formatDurationToHHMM = (durationMinutes: number): string => {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.floor(durationMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  formatDateTimeWithDayOfWeek = (date: Date): string => {
    const dateWithDayOfWeek = this.formatDateWithDayOfWeek(date);
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${dateWithDayOfWeek} ${hours}:${minutes}`;
  };

  formatDateWithDayOfWeek = (date: Date): string => {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      date.getUTCDay()
    ];
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${date.getUTCFullYear()}/${month}/${day} (${dayOfWeek})`;
  };
  formatStartEnd = (start: Date, end: Date): string => {
    const endDate =
      start.getUTCFullYear() === end.getUTCFullYear() &&
      start.getUTCMonth() === end.getUTCMonth() &&
      start.getUTCDate() === end.getUTCDate()
        ? `${String(end.getUTCHours()).padStart(2, '0')}:${String(end.getUTCMinutes()).padStart(2, '0')}`
        : this.formatDateTimeWithDayOfWeek(end);
    return `${this.formatDateTimeWithDayOfWeek(start)} - ${endDate}`;
  };
}
