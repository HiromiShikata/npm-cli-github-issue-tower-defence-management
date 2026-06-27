export interface OwnerCallStatusProvider {
  listSessionNamesWithUnansweredOwnerCall: (
    transcriptPathBySessionName: Map<string, string>,
  ) => Promise<Set<string>>;
}
