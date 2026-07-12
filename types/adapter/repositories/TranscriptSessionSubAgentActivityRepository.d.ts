import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
export declare const normalizeCommandFragment: (command: string) => string;
export declare class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
    private readonly directoryResolver;
    private readonly processLister;
    private readonly now;
    constructor(directoryResolver: SubAgentTranscriptDirectoryResolver, processLister: SubAgentProcessLister, now: Date);
    listSubAgentActivitiesBySessionName: (sessionNames: string[], transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, SubAgentActivity[]>>;
    private collectActivities;
    private toActivity;
    private hasLiveMatchingProcess;
}
//# sourceMappingURL=TranscriptSessionSubAgentActivityRepository.d.ts.map