export type TakeOwnershipSpawn = {
  token: string;
  logPath: string;
};

export interface TakeOwnershipSpawnRepository {
  listSpawns: () => TakeOwnershipSpawn[];
}
