import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';
export declare class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
    listSessionOutputActivities: (transcriptPathBySessionName: Map<string, string>) => Promise<LiveSessionOutputActivity[]>;
    private readTranscriptActivity;
}
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.d.ts.map