export interface DateRepository {
  now(): Promise<Date>;
}
