export interface DateRepository {
  now(): Promise<Date>;
  formatDurationToHHMM(durationMinutes: number): string;
  formatDateTimeWithDayOfWeek(date: Date): string;
  formatDateWithDayOfWeek(date: Date): string;
  formatStartEnd(startedAt: Date, endedAt: Date): string;
}
//# sourceMappingURL=DateRepository.d.ts.map
