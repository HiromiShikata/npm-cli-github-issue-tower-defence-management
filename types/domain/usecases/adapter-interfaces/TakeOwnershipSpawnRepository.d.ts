export type TakeOwnershipSpawn = {
    token: string;
    logPath: string;
};
export interface TakeOwnershipSpawnRepository {
    listSpawns: () => TakeOwnershipSpawn[];
    listRunningIssueUrls: () => string[];
}
//# sourceMappingURL=TakeOwnershipSpawnRepository.d.ts.map