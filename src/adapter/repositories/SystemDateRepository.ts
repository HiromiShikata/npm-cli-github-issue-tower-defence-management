import { DateRepository } from '../../domain/usecases/adapter-interfaces/DateRepository';

export class SystemDateRepository implements DateRepository {
  now = async () => new Date();
  formatDurationToHHMM = (durationMinutes: number): string => {
    const hours = Math.floor(durationMinutes / 60);
    const minutes = Math.floor(durationMinutes % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  formatDateTimeWithDayOfWeek = (date: Date): string => {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      date.getDay()
    ];
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}/${month}/${day} (${dayOfWeek}) ${hours}:${minutes}`;
  };
}
