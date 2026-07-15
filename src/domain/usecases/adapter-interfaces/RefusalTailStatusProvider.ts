export interface RefusalTailStatusProvider {
  listRefusalTailedSessionNames: (
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<Set<string>>;
}
