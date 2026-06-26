import { TakeOwnershipSpawn, TakeOwnershipSpawnRepository } from '../../domain/usecases/adapter-interfaces/TakeOwnershipSpawnRepository';
export declare class ProcTakeOwnershipSpawnRepository implements TakeOwnershipSpawnRepository {
    private readonly procDirectory;
    constructor(procDirectory?: string);
    listSpawns: () => TakeOwnershipSpawn[];
    private listProcessIdDirectories;
    private readSpawn;
    private readRawCmdline;
    private readEnviron;
}
//# sourceMappingURL=ProcTakeOwnershipSpawnRepository.d.ts.map