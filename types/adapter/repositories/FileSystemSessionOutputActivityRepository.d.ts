import { LiveSessionOutputActivity } from '../../domain/entities/LiveSessionOutputActivity';
import { SessionOutputActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionOutputActivityRepository';
/**
 * Reads the last main-session activity time for each live session from its
 * already-resolved transcript path. Idle time is computed from the timestamp of
 * the latest entry of any kind (assistant text, owner replies, tool results, or
 * any other entry type) rather than from the transcript file modification time.
 * Because a session that is actively running tool calls keeps appending entries
 * such as `user` and `tool_result` even while it emits no assistant text, every
 * entry with a parseable timestamp counts as activity, so a working session is
 * not mistaken for a silent one.
 */
export declare class FileSystemSessionOutputActivityRepository implements SessionOutputActivityRepository {
    listSessionOutputActivities: (transcriptPathBySessionName: Map<string, string>) => Promise<LiveSessionOutputActivity[]>;
    private readLastActivityEpochSeconds;
}
//# sourceMappingURL=FileSystemSessionOutputActivityRepository.d.ts.map