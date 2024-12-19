export interface DateRepository {
  now(): Promise<Date>;
  formatDurationToHHMM(durationMinutes: number): string;
  formatDateTimeWithDayOfWeek(date: Date): string;
  formatStartEnd(startedAt: Date, endedAt: Date): string;
}
