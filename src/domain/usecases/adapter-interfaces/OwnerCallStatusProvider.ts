export interface OwnerCallStatusProvider {
  listSessionNamesWithUnansweredOwnerCall: (
    sessionNames: string[],
  ) => Promise<Set<string>>;
}
