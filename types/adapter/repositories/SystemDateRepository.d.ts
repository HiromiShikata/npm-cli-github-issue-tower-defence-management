import { DateRepository } from '../../domain/usecases/adapter-interfaces/DateRepository';
export declare class SystemDateRepository implements DateRepository {
    now: () => Promise<Date>;
    formatDurationToHHMM: (durationMinutes: number) => string;
    formatDateTimeWithDayOfWeek: (date: Date) => string;
}
//# sourceMappingURL=SystemDateRepository.d.ts.map