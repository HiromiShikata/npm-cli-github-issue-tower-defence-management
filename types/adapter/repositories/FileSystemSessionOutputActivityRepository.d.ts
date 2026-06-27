import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';
export declare class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
    private readonly rootDirectory;
    constructor(rootDirectory: string | null);
    listSessionOutputActivities: (sessionNames: string[]) => Promise<LiveSessionOutputActivity[]>;
    private readLastOutputEpochSeconds;
    private toOutputFileName;
}
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.d.ts.map