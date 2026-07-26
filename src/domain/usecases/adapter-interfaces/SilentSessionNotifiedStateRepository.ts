export interface SilentSessionNotifiedStateRepository {
  loadRecentNotifiedSessionNames: (params: {
    now: Date;
    recencyWindowSeconds: number;
  }) => Promise<Set<string>>;
  saveNotifiedSessionNames: (params: {
    sessionNames: string[];
    now: Date;
  }) => Promise<void>;
}
