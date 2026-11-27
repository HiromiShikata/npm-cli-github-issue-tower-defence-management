export type TakeOwnershipSpawn = {
  token: string;
  logPath: string;
  issueUrl: string | null;
};

export interface TakeOwnershipSpawnRepository {
  listSpawns: () => TakeOwnershipSpawn[];
  listRunningIssueUrls: () => string[];
}
