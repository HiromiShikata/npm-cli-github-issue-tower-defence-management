export interface SessionDegenerationCooldownStateRepository {
  loadLastResetEpochSecondsBySessionName: () => Promise<Map<string, number>>;
  recordReset: (params: { sessionName: string; now: Date }) => Promise<void>;
}
