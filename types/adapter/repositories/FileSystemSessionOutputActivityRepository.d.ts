import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';
/**
 * Reads the last main-session output time for each live session from its
 * already-resolved transcript path. Idle time is computed from the timestamp of
 * the latest `assistant` entry rather than from the transcript file modification
 * time, so a transcript touched only by tool results or owner replies still
 * counts as silent.
 */
export declare class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
    listSessionOutputActivities: (transcriptPathBySessionName: Map<string, string>) => Promise<LiveSessionOutputActivity[]>;
    private readLastAssistantOutputEpochSeconds;
}
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.d.ts.map