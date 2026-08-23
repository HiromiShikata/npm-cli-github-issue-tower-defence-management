import { SubAgentActivity } from '../../domain/entities/LiveSessionActivitySnapshot';
import { SessionSubAgentActivityRepository } from '../../domain/usecases/adapter-interfaces/SessionSubAgentActivityRepository';
import { SubAgentLivenessResolver } from '../../domain/usecases/adapter-interfaces/SubAgentLivenessResolver';
import { SubAgentProcessLister } from '../../domain/usecases/adapter-interfaces/SubAgentProcessLister';
import { SubAgentTranscriptDirectoryResolver } from '../../domain/usecases/adapter-interfaces/SubAgentTranscriptDirectoryResolver';
export declare const normalizeCommandFragment: (command: string) => string;
export declare class TranscriptSessionSubAgentActivityRepository implements SessionSubAgentActivityRepository {
    private readonly directoryResolver;
    private readonly processLister;
    private readonly now;
    private readonly livenessResolver;
    private readonly runtimeRootDirectory;
    constructor(directoryResolver: SubAgentTranscriptDirectoryResolver, processLister: SubAgentProcessLister, now: Date, livenessResolver?: SubAgentLivenessResolver, runtimeRootDirectory?: string | null);
    listSubAgentActivitiesBySessionName: (sessionNames: string[], transcriptPathBySessionName: Map<string, string>) => Promise<Map<string, SubAgentActivity[]>>;
    private loadTerminalAgentIds;
    private resolveOutputFilePath;
    private collectActivities;
    private toActivity;
    private hasLiveMatchingProcess;
}
//# sourceMappingURL=TranscriptSessionSubAgentActivityRepository.d.ts.map