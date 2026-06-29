import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
export declare class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
    private readonly directoryResolver;
    private readonly now;
    private readonly silentCeilingSeconds;
    constructor(directoryResolver: SubAgentTranscriptDirectoryResolver, now: Date, silentCeilingSeconds: number);
    listSubAgentActivitiesBySessionName: (sessionNames: string[], transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, SubAgentActivity[]>>;
    private collectActivities;
    private toActivity;
}
//# sourceMappingURL=TranscriptSessionSubAgentActivityRepository.d.ts.map