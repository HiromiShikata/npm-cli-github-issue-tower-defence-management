export interface SilentSessionNotifiedStateRepository {
  loadRecentNotifiedSectionKeys: (params: {
    now: Date;
    recencyWindowSeconds: number;
  }) => Promise<Set<string>>;
  saveNotifiedSectionKeys: (params: {
    sectionKeys: string[];
    now: Date;
  }) => Promise<void>;
}
