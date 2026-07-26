export interface OwnerCallStatusProvider {
  listUnansweredOwnerCallEpochSecondsBySessionName: (
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<Map<string, number>>;
}
